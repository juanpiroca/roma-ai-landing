'use strict';

const seller = require('./seller');
const memCh = require('./memory-channel');
const chatCommands = require('./chat-commands');
const n8nExecute = require('./n8n-execute');
const pricing = require('./pricing');
const audit = require('./audit');

const STATES = Object.freeze({
  NEW: 'new',
  Q1_OK: 'q1_ok',
  Q2_OK: 'q2_ok',
  Q3_OK: 'q3_ok',
  Q4_OK: 'q4_ok',
  PROPOSAL: 'proposal',
  SELLER: 'seller',
  IDLE_24: 'idle_24',
  IDLE_72: 'idle_72',
  COLD: 'cold',
  CLOSED: 'closed',
  LOST: 'lost',
});

const QUESTIONS = [
  { key: 'name', ask: 'Hola, soy Roma. ¿Con quién hablo y en qué rubro está tu negocio?' },
  { key: 'project', ask: '¿Qué querés construir o resolver? (tienda online, app, web, automatización, campañas de marketing, etc.)' },
  { key: 'budget', ask: '¿Tenés idea del presupuesto? Así te doy una propuesta realista. Menos de $500 / $500-2000 / $2000-5000 / más de $5000.' },
  { key: 'urgency', ask: '¿Para cuándo lo necesitás? Esta semana, este mes, o sin fecha fija.' },
];
const SUPPORT_KEYWORDS = ['error', 'no funciona', 'problema', 'bug', 'ayuda técnica', 'soporte', 'falla', 'roto', 'broken', 'no carga'];

function parseBudget(budgetStr) {
  const lower = budgetStr.toLowerCase();
  if (lower.includes('menos de 500')) return 250;
  if (lower.includes('500-2000')) return 1250;
  if (lower.includes('2000-5000')) return 3500;
  if (lower.includes('más de 5000')) return 6000;
  return 0;
}

function parseUrgency(urgencyStr) {
  const lower = urgencyStr.toLowerCase();
  if (lower.includes('esta semana')) return 7;
  if (lower.includes('este mes')) return 30;
  if (lower.includes('sin prisa')) return 90;
  return 90;
}

function normalizeProjectType(value) {
  const text = String(value || '').toLowerCase();
  if (/(ecommerce|e-commerce|tienda|shop|catalogo|catálogo)/.test(text)) return 'ecommerce';
  if (/(app|aplicaci[oó]n|mobile|m[oó]vil|ios|android)/.test(text)) return 'app_mobile';
  if (/(landing|one page|onepager|p[aá]gina)/.test(text)) return 'landing';
  if (/(automatiz|workflow|bot|integraci[oó]n)/.test(text)) return 'automation';
  if (/(marketing|ads|meta ads|google ads|contenido|redes)/.test(text)) return 'marketing';
  return 'general';
}

function nextState(current) {
  const order = [STATES.NEW, STATES.Q1_OK, STATES.Q2_OK, STATES.Q3_OK, STATES.Q4_OK, STATES.PROPOSAL, STATES.SELLER];
  const i = order.indexOf(current);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : current;
}

async function handleIncoming({ channel, externalId, text, meta = {} }) {
  const leadId = channel === 'whatsapp' && !String(externalId).startsWith('wa_') ? `wa_${externalId}` : String(externalId);
  const existing = memCh.findLeadByExternalId(channel, leadId)
    || await memCh.findLeadByPhoneOrFuzzy({ phone: meta.phone, email: meta.email, name: meta.name || meta.firstName, project: meta.project });
  const sessionId = existing?.sessionId || leadId;
  if (!seller.getPayload(sessionId)) seller.startSession(sessionId);
  const lead = seller.getPayload(sessionId) || { sessionId, flow: {}, stage: STATES.NEW, createdAt: new Date().toISOString() };
  lead.sessionId = lead.sessionId || sessionId;
  lead.flow = lead.flow || {};
  lead.channel = lead.channel || channel;
  lead.history = Array.isArray(lead.history) ? lead.history : [];
  const answers = lead.flow.answers || {};
  const current = lead.flow.state || lead.state || STATES.NEW;
  const inboundText = String(text || '').trim();
  if (inboundText) {
    lead.history.push({ ts: new Date().toISOString(), channel, dir: 'in', text: inboundText, meta });
  }

  function syncProspectStatus(status, revenue = 0) {
    try {
      const prospector = require('../prospecting/prospector');
      if (status === STATES.CLOSED) prospector.markClosed(lead.sessionId, revenue);
      if (status === STATES.LOST) prospector.markLost(lead.sessionId);
      prospector.updateLeadStatus(lead.sessionId, { fsm_state: status, lastInteraction: new Date().toISOString() });
    } catch (_) {}
  }

  function triggerOnboardingWorkflow() {
    try {
      const contracts = require('./workflow-contracts').load();
      const onboarding = (contracts.workflows || []).find((workflow) => Array.isArray(workflow.tags) && workflow.tags.includes('onboarding'));
      if (!onboarding) return;
      n8nExecute.prepare(onboarding.id, { leadId: lead.sessionId, name: lead.name, project: lead.project }, { ip: 'fsm', user: lead.sessionId })
        .then((result) => audit.log({ ts: new Date().toISOString(), event: 'n8n_onboarding_triggered', leadId: lead.sessionId, execId: result.body?.execId || null }))
        .catch(() => {});
    } catch (_) {}
  }

  // Check for closed/lost signals
  if (inboundText) {
    const lowerText = inboundText.toLowerCase();
    if (lowerText.includes('acepto') || lowerText.includes('sí quiero') || lowerText.includes('confirmado') || lowerText.includes('cerramos')) {
      lead.flow.state = STATES.CLOSED;
      lead.stage = STATES.CLOSED;
      lead.status = 'closed';
      lead.fsm_state = STATES.CLOSED;
      syncProspectStatus(STATES.CLOSED, lead.revenue || 0);
      triggerOnboardingWorkflow();
      seller.saveLead(lead.sessionId);
      return { reply: 'Excelente, cerramos. Te contacto enseguida para avanzar.', state: STATES.CLOSED, leadId: lead.sessionId, actions: ['seller_continue'], lead };
    }
    if (lowerText.includes('no gracias') || lowerText.includes('no me interesa') || lowerText.includes('cancelar')) {
      lead.flow.state = STATES.LOST;
      lead.stage = STATES.LOST;
      lead.status = 'lost';
      lead.fsm_state = STATES.LOST;
      syncProspectStatus(STATES.LOST);
      seller.saveLead(lead.sessionId);
      return { reply: 'Entendido, gracias por avisarme. Si querés retomarlo más adelante, acá estoy.', state: STATES.LOST, leadId: lead.sessionId, actions: [], lead };
    }
  }

  const parsedCommand = chatCommands.parseCommand(inboundText);
  if (parsedCommand?.type === 'workflow') {
    const payload = chatCommands.argsToPayload(parsedCommand.contract, parsedCommand.args);
    const prepared = await n8nExecute.prepare(parsedCommand.contract.id, payload, {
      ip: meta.ip || `channel:${channel}`,
      user: sessionId,
    });
    const reply = prepared.ok
      ? chatCommands.renderPreview({
        contract: parsedCommand.contract,
        payload,
        execId: prepared.body.execId,
        requiresConfirm: Boolean(prepared.body.requires_confirmation),
      })
      : `No pude preparar el workflow: ${prepared.body.error}`;
    lead.history.push({ ts: new Date().toISOString(), channel, dir: 'out', text: reply, meta: {} });
    seller.saveLead(lead.sessionId);
    return { reply, state: current, leadId: lead.sessionId, actions: ['n8n_prepare'], n8n: prepared.body };
  }

  if (parsedCommand?.type === 'confirm') {
    const confirmed = await n8nExecute.confirm(parsedCommand.execId, true, {
      ip: meta.ip || `channel:${channel}`,
      user: sessionId,
    });
    const reply = confirmed.ok
      ? `Workflow ejecutado: ${confirmed.body.workflow.nombre}`
      : `No pude confirmar la ejecución: ${confirmed.body.error}`;
    lead.history.push({ ts: new Date().toISOString(), channel, dir: 'out', text: reply, meta: {} });
    seller.saveLead(lead.sessionId);
    return { reply, state: current, leadId: lead.sessionId, actions: ['n8n_confirm'], n8n: confirmed.body };
  }

  if (inboundText && SUPPORT_KEYWORDS.some((keyword) => inboundText.toLowerCase().includes(keyword))) {
    const reply = `Entendido, te ayudo con el problema. Para resolverlo rápido necesito:\n1. ¿Qué estabas haciendo cuando ocurrió?\n2. ¿Qué mensaje de error ves?\n3. ¿En qué sección?\nRespondeme esas 3 cosas y lo resuelvo.`;
    lead.flow.state = 'support';
    lead.stage = 'support';
    lead.fsm_state = 'support';
    lead.history.push({ ts: new Date().toISOString(), channel, dir: 'out', text: reply, meta: {} });
    seller.saveLead(lead.sessionId);
    return { reply, state: 'support', leadId: lead.sessionId, actions: ['support_ticket'], lead };
  }

  if (current === STATES.NEW) {
    lead.flow.state = STATES.Q1_OK;
    lead.stage = STATES.Q1_OK;
    lead.fsm_state = STATES.Q1_OK;
    lead.flow.answers = answers;
    const reply = QUESTIONS[0].ask;
    lead.history.push({ ts: new Date().toISOString(), channel, dir: 'out', text: reply, meta: {} });
    seller.saveLead(lead.sessionId);
    return { reply, state: STATES.Q1_OK, leadId: lead.sessionId, actions: ['ask_name'], lead };
  }

  const questionIndex = [STATES.Q1_OK, STATES.Q2_OK, STATES.Q3_OK, STATES.Q4_OK].indexOf(current);
  if (questionIndex >= 0) {
    answers[QUESTIONS[questionIndex].key] = inboundText;
    lead[QUESTIONS[questionIndex].key] = inboundText;
    const next = nextState(current);
    lead.flow.state = next;
    lead.stage = next;
    lead.fsm_state = next;
    lead.flow.answers = answers;
    if (next === STATES.PROPOSAL) {
      lead.project = answers.project;
      lead.flow.business_type = normalizeProjectType(answers.project);
      lead.flow.budget = answers.budget;
      lead.flow.urgency = answers.urgency;
      const budgetNum = parseBudget(lead.flow.budget || '');
      const urgencyDays = parseUrgency(lead.flow.urgency || '');
      let score = 'low';
      if (budgetNum > 2000 && urgencyDays < 30) score = 'high';
      else if (budgetNum > 500) score = 'medium';
      lead.score = score;
      const estimate = pricing.estimate(lead);
      lead.pricing = estimate;
      lead.revenue = estimate.max;
      lead.pricing_conflict = Boolean(estimate.pricing_conflict);
      const proposal = seller.generateProposal(lead);
      lead.flow.proposal = proposal;
      lead.stage = STATES.PROPOSAL;
      lead.history.push({ ts: new Date().toISOString(), channel, dir: 'out', text: proposal, meta: {} });
      seller.saveLead(lead.sessionId);
      return { reply: proposal, state: STATES.PROPOSAL, leadId: lead.sessionId, actions: ['proposal_generated', 'schedule_idle_24'], lead };
    }
    const nextQuestion = QUESTIONS[questionIndex + 1];
    lead.history.push({ ts: new Date().toISOString(), channel, dir: 'out', text: nextQuestion.ask, meta: {} });
    seller.saveLead(lead.sessionId);
    return { reply: nextQuestion.ask, state: next, leadId: lead.sessionId, actions: [`ask_${nextQuestion.key}`], lead };
  }

  const reply = 'Perfecto, sigo con vos. ¿Querés que avancemos con la propuesta?';
  lead.history.push({ ts: new Date().toISOString(), channel, dir: 'out', text: reply, meta: {} });
  seller.saveLead(lead.sessionId);
  return { reply, state: STATES.SELLER, leadId: lead.sessionId, actions: ['seller_continue'], lead };
}

async function triggerFollowup(leadId, stage) {
  void leadId;
  void stage;
  return { sent: false, via: null, skipped_reason: 'not_implemented' };
}

function getStateMachine() {
  return { states: Object.values(STATES), questions: QUESTIONS };
}

module.exports = { STATES, QUESTIONS, nextState, handleIncoming, triggerFollowup, getStateMachine };
