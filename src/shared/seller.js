// Roma — agente principal, flujo comercial multi-canal
// André = community manager (social.js) | Luka = director creativo (studio.js)

const fs = require('fs');
const path = require('path');
const pricing = require('./pricing');

const SYSTEM_PROMPT = `Eres Roma. Formás parte de un equipo que ayuda a negocios a crecer con tecnología y automatización.

IDENTIDAD — nunca rompas esto:
- Nunca digas que sos un bot, IA, inteligencia artificial ni asistente virtual
- Si alguien te pregunta si sos una IA, respondé con naturalidad: "Soy Roma, parte del equipo"
- Nunca uses frases robóticas ni listes funcionalidades de entrada

IDIOMA:
- Si el cliente escribe en español → respondé siempre en español
- Si el cliente escribe en inglés → respondé siempre en inglés
- No mezcles idiomas en el mismo mensaje

PERSONALIDAD (calibrala al clima de la conversación):
- Por defecto: cálida, cercana, directa
- Si el cliente es informal o usa humor → podés ser más suelta y divertida
- Si el cliente es formal o habla de proyectos serios → mantené tono profesional sin perder calidez
- Nunca seas robótica. Nunca seas agresivamente vendedora. Nunca seas cursi en exceso

OBJETIVO REAL:
Tu trabajo es entender qué necesita el negocio del cliente.
No vendas de entrada. Primero escuchá. Hacé preguntas inteligentes una por una.
Cuando entiendas bien el problema, proponé una solución en las palabras del cliente.
Solo hablá de precio cuando el cliente validó que la propuesta tiene sentido para él.

FLUJO NATURAL:
1. Saludá brevemente y preguntá en qué podés ayudar
2. Escuchá y hacé preguntas para entender el negocio y el problema real
3. Cuando tengas suficiente contexto, describí la solución de forma simple y concreta
4. Si el cliente muestra interés real, presentá precio con confianza
5. Si el cliente acepta, explicá el siguiente paso — continuar por WhatsApp: +1 (201) 969-6812
6. Si el cliente no está listo, dejalo tranquilo — no insistas

SERVICIOS (no los enumeres de entrada — presentalos cuando sean relevantes):
- Automatización de procesos: lo que el negocio necesite
- Producción creativa con IA: videos realistas, animados, con lipsync
- Community Manager con IA: posts, anuncios, respuestas humanizadas

SEÑALES DE INTERÉS REAL: menciona presupuesto, fecha, proyecto concreto, empresa, urgencia
SEÑALES DE CURIOSIDAD: preguntas vagas, sin contexto — respondé amable pero breve

RESTRICCIONES:
- Respuestas cortas y directas — nunca párrafos largos
- Una pregunta por mensaje — no hagas dos preguntas juntas
- No menciones tecnologías internas (Claude, GPT, n8n, etc.)
- No hagas promesas que no podés cumplir`;

const sessions = new Map(); // sessionId -> { category, exchanges, email, stage }
const LEADS_DIR = path.join(__dirname, '../../data/leads');
const PROPOSALS_DIR = path.join(__dirname, '../../data/proposals');

// ── Brainstorming questions por categoría ─────────────────────
const BRAINSTORMING_QUESTIONS = {
  secretary: [
    '¿Qué tipo de consultas recibís más? (llamadas, WhatsApp, email...)',
    '¿Cuántos contactos entran por semana aproximadamente?',
    '¿Necesitás que agende citas o solo que responda preguntas?',
    '¿Tenés horario de atención definido o querés que funcione 24/7?',
  ],
  studio: [
    '¿Qué tipo de contenido necesitás? (videos, reels, imágenes, con personas...)',
    '¿Tenés referentes o ejemplos de estilo que te gusten?',
    '¿Para qué plataforma es principalmente? (Instagram, YouTube, TikTok...)',
    '¿Cuántas piezas necesitás por mes o es un proyecto puntual?',
  ],
  social: [
    '¿En qué redes sociales está tu negocio o querés estar?',
    '¿Tenés contenido propio (fotos, videos) o necesitás generarlo desde cero?',
    '¿Cuántos posts por semana tenés en mente?',
    '¿El objetivo es visibilidad, ventas, comunidad o los tres?',
  ],
  web: [
    '¿Qué tipo de sitio necesitás? (landing, tienda, portfolio, institucional...)',
    '¿Ya tenés dominio y hosting o arrancamos desde cero?',
    '¿Necesitás que se actualice seguido o es un sitio estático?',
    '¿Tenés referencias de diseño o paleta de colores de tu marca?',
  ],
  automation: [
    '¿Qué proceso querés automatizar? Describilo en pasos.',
    '¿Qué herramientas usás hoy? (CRM, email, Google Sheets, WhatsApp...)',
    '¿Cuánto tiempo te lleva hacer ese proceso manualmente por semana?',
    '¿Hay algún punto donde sí o sí tiene que intervenir una persona?',
  ],
  general: [
    '¿Qué es lo que más tiempo te consume en tu negocio hoy?',
    '¿Qué problema querés resolver con IA o automatización?',
    '¿Tenés un presupuesto en mente o todavía estás evaluando?',
    '¿Cuándo necesitarías tener esto funcionando?',
  ],
};

function _ensureDir() {
  if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR, { recursive: true });
  if (!fs.existsSync(PROPOSALS_DIR)) fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
}

function _leadPath(sessionId) {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(LEADS_DIR, `${safe}.json`);
}

function saveLead(sessionId) {
  _ensureDir();
  const data = sessions.get(sessionId);
  if (!data) return;
  try {
    fs.writeFileSync(
      _leadPath(sessionId),
      JSON.stringify({ sessionId, ...data, updatedAt: new Date().toISOString() }, null, 2)
    );
  } catch (e) {
    console.error('[seller] Error guardando lead:', e.message);
  }
}

function loadLead(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(_leadPath(sessionId), 'utf8'));
  } catch {
    return null;
  }
}

function startSession(sessionId) {
  const existing = loadLead(sessionId);
  if (existing && !['cleared', 'cold', 'closed'].includes(existing.stage)) {
    sessions.set(sessionId, existing);
    return {
      text: '👋 Hola de nuevo, soy Roma. ¿En qué puedo ayudarte?',
      stage: existing.stage
    };
  }
  const newSession = {
    category: null,
    exchanges: 0,
    email: null,
    stage: 'greeting',
    createdAt: new Date().toISOString()
  };
  sessions.set(sessionId, newSession);
  saveLead(sessionId);
  return {
    text: '👋 Hola, soy Roma. ¿En qué puedo ayudarte hoy?',
    stage: 'greeting'
  };
}

function scoreCategory(text) {
  const t = text.toLowerCase();
  if (/secretar|recepcionist|llamad|call|voicemail|atiend|telefon/.test(t)) return 'secretary';
  if (/video|studio|productora|animaci|reels|contenido|luka/.test(t)) return 'studio';
  if (/redes|social|instagram|facebook|post|comentari|andré|community/.test(t)) return 'social';
  if (/web|página|sitio|landing|tienda|ecommerce|shop/.test(t)) return 'web';
  if (/automatiz|bot|flujo|workflow|n8n|zapier/.test(t)) return 'automation';
  if (/precio|costo|cuanto|cuánto|budget|plan|pagar/.test(t)) return 'pricing';
  return 'general';
}

function isHighPriority(text) {
  const t = text.toLowerCase();
  return /quiero|necesito|contratar|empezar|arrancar|cuando podemos|cuándo podemos|avanzar|listo|dale|hagámoslo|let.s go|let's do|sign me up|ready/.test(t);
}

function extractEmail(text) {
  const m = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  return m ? m[0] : null;
}

function getPayload(sessionId) {
  return sessions.get(sessionId) || null;
}

function clearSession(sessionId) {
  saveLead(sessionId);
  sessions.delete(sessionId);
}

// ── Brainstorming ─────────────────────────────────────────────

function startBrainstorming(sessionId, topic) {
  _ensureDir();
  let session = sessions.get(sessionId);
  if (!session) {
    session = { category: null, exchanges: 0, email: null, stage: 'greeting', createdAt: new Date().toISOString() };
    sessions.set(sessionId, session);
  }
  const cat = scoreCategory(topic) || 'general';
  session.category = cat;
  session.stage = 'brainstorming';
  session.brainstorming = {
    active: true,
    topic,
    phase: 'questions',
    questionIndex: 0,
    answers: [],
  };
  saveLead(sessionId);
  const questions = BRAINSTORMING_QUESTIONS[cat] || BRAINSTORMING_QUESTIONS.general;
  return `Buenísimo, hablemos de *${topic}*.\n\n${questions[0]}`;
}

function handleBrainstorming(sessionId, text) {
  _ensureDir();
  const session = sessions.get(sessionId);
  if (!session?.brainstorming?.active) return null;

  const bs = session.brainstorming;
  bs.answers.push(text);
  const cat = session.category || 'general';
  const questions = BRAINSTORMING_QUESTIONS[cat] || BRAINSTORMING_QUESTIONS.general;
  bs.questionIndex++;

  if (bs.questionIndex < questions.length) {
    saveLead(sessionId);
    return questions[bs.questionIndex];
  }

  // Todas las preguntas respondidas → generar propuesta
  bs.phase = 'proposal';
  const propId = `prop_${sessionId}_${Date.now()}`;
  const brief = bs.answers.join(' | ');
  const proposalText = generateProposal({
    name: session.name,
    project: bs.topic,
    timeline: bs.answers[2],
    budget: bs.answers[3],
    category: cat
  });
  const estimate = pricing.estimate({
    project: bs.topic,
    timeline: bs.answers[2],
    budget: bs.answers[3],
    category: cat
  });

  const proposal = {
    id: propId,
    client_session: sessionId,
    topic: bs.topic,
    category: cat,
    brief,
    includes: [`Desarrollo del sistema de ${bs.topic}`, 'Setup y configuración', 'Pruebas y ajustes', 'Soporte 30 días'],
    excludes: ['Contenido externo no acordado', 'Mantenimiento mensual (se cotiza aparte)'],
    price_usd_min: estimate.min,
    price_usd_max: estimate.max,
    timeline: `${estimate.timeline_weeks} semanas`,
    modality: estimate.format,
    pricing_conflict: estimate.pricing_conflict,
    proposal_text: proposalText,
    status: 'pending_approval',
    created_at: new Date().toISOString(),
    approved_at: null,
  };

  const propPath = path.join(PROPOSALS_DIR, `${propId}.json`);
  fs.writeFileSync(propPath, JSON.stringify(proposal, null, 2));
  session.stage = 'pending_approval';
  session.proposalId = propId;
  bs.active = false;
  saveLead(sessionId);

  return proposalText;
}

function generateProposal(lead = {}) {
  const estimate = pricing.estimate(lead);
  const name = lead.name || 'che';
  const project = lead.project || 'tu proyecto';
  const bullets = [
    `Scope sugerido: discovery y arquitectura para ${project}`,
    'Implementacion iterativa con entregas visibles',
    'QA y ajuste final con soporte de arranque',
  ];
  return `Gracias ${name}. Para ${project}:\n`
    + `- ${bullets[0]}\n`
    + `- ${bullets[1]}\n`
    + `- ${bullets[2]}\n`
    + `- Timeline estimado: ${estimate.timeline_weeks} semanas\n`
    + `- Inversion estimada: USD ${estimate.min}-${estimate.max}\n`
    + `- Modalidad: ${estimate.format}\n`
    + `Si te hace sentido, avanzamos con un detalle tecnico. Seguimos?`;
}

function approveProposal(sessionId) {
  const session = sessions.get(sessionId);
  const propId = session?.proposalId;
  if (!propId) return null;
  const propPath = path.join(PROPOSALS_DIR, `${propId}.json`);
  try {
    const proposal = JSON.parse(fs.readFileSync(propPath, 'utf8'));
    proposal.status = 'approved';
    proposal.approved_at = new Date().toISOString();
    proposal.approvalReason = 'approved_by_admin';
    proposal.approvedBy = 'dashboard_session';
    proposal.rejectionReason = proposal.rejectionReason || null;
    fs.writeFileSync(propPath, JSON.stringify(proposal, null, 2));
    if (session) { session.stage = 'approved'; saveLead(sessionId); }
    return proposal;
  } catch { return null; }
}

function getProposals() {
  _ensureDir();
  return fs.readdirSync(PROPOSALS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(PROPOSALS_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = {
  SYSTEM_PROMPT,
  startSession,
  scoreCategory,
  isHighPriority,
  extractEmail,
  getPayload,
  clearSession,
  saveLead,
  loadLead,
  startBrainstorming,
  handleBrainstorming,
  generateProposal,
  approveProposal,
  getProposals,
};
