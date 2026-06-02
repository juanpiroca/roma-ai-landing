const { scheduleRespectingHours } = require('./followup');
const audit = require('./audit');
const n8nClient = require('../services/n8n-client');

const ALLOWED_ACTIONS = new Set([
  'schedule_idle_24',
  'schedule_idle_72',
  'proposal_generated',
  'n8n_prepare',
  'n8n_confirm',
  'support_ticket',
  'seller_continue',
]);

async function dispatchActions(actions, lead = {}, deps = {}) {
  if (!Array.isArray(actions) || actions.length === 0) return [];
  const leadId = lead.id || lead.leadId || lead.sessionId || lead.externalId;
  if (!leadId) return [];
  const results = [];
  const scheduleFn = deps.scheduleRespectingHours || scheduleRespectingHours;
  const auditLog = deps.audit?.log || audit.log;
  const n8n = deps.n8nClient || n8nClient;
  for (const action of actions) {
    try {
      if (typeof action === 'object' && action?.type === 'n8n') {
        const workflowId = action.workflowId || action.workflow || action.name;
        if (!workflowId) {
          results.push({ ok: false, error: 'missing_workflow_id', action });
          continue;
        }
        const response = await n8n.triggerWorkflow(workflowId, action.data || { leadId, channel: lead.channel || null });
        auditLog({ ts: new Date().toISOString(), event: 'n8n_action_triggered', action: workflowId, leadId, channel: lead.channel || null });
        results.push({ ok: true, action: 'n8n', workflowId, response });
        continue;
      }
      if (!ALLOWED_ACTIONS.has(action)) {
        const rejected = { ok: false, error: 'action_not_allowed', action };
        auditLog({ ts: new Date().toISOString(), event: 'action_rejected_unknown', action, leadId, channel: lead.channel || null });
        results.push(rejected);
        continue;
      }
      switch (action) {
        case 'schedule_idle_24':
          scheduleFn(leadId, 'idle_24');
          results.push({ ok: true, action });
          break;
        case 'schedule_idle_72':
          scheduleFn(leadId, 'idle_72');
          results.push({ ok: true, action });
          break;
        case 'proposal_generated':
        case 'n8n_prepare':
        case 'n8n_confirm':
          auditLog({ ts: new Date().toISOString(), event: action, leadId, score: lead.score });
          results.push({ ok: true, action });
          break;
        case 'support_ticket':
          auditLog({ ts: new Date().toISOString(), event: 'support_ticket', leadId, channel: lead.channel });
          results.push({ ok: true, action });
          break;
        case 'seller_continue':
          results.push({ ok: true, action });
          break;
      }
    } catch (error) {
      console.error(`[dispatcher] ${action} failed:`, error.message || error);
      auditLog({ ts: new Date().toISOString(), event: 'action_failed', action, leadId, error: error.message || String(error) });
      results.push({ ok: false, error: error.message || 'dispatch_failed', action });
    }
  }
  return results;
}

module.exports = { dispatchActions, ALLOWED_ACTIONS };
