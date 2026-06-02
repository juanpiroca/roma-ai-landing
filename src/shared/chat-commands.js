'use strict';

const contracts = require('./workflow-contracts');

function parseCommand(text) {
  if (!text || !String(text).trim().startsWith('/')) return null;
  const parts = String(text).trim().split(/\s+/);
  const command = parts[0];
  const rest = parts.slice(1);
  if (command === '/confirmar') return { type: 'confirm', execId: rest[0] || '' };
  const contract = contracts.findByComando(command);
  if (!contract) return null;
  return { type: 'workflow', contract, args: rest };
}

function argsToPayload(contract, args) {
  if (contract.id === 'dwm') return { action: args[0] || 'status', notes: args.slice(1).join(' ') };
  if (contract.id === 'prospectos') {
    const source = args[0] || 'telegram';
    let lead = {};
    try {
      lead = JSON.parse(args.slice(1).join(' ') || '{}');
    } catch (_) {}
    return { source, lead };
  }
  if (contract.id === 'marketing') {
    return { campaign: args[0] || '', segment: args[1] || '', message: args.slice(2).join(' '), dry_run: true };
  }
  if (contract.id === 'facebook-ads') {
    return { ad_account_id: args[0] || '', audience_id: args[1] || '', budget_usd: Number(args[2] || 0) };
  }
  return {};
}

function renderValue(value) {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

function renderPreview({ contract, payload, execId, requiresConfirm }) {
  const fields = Object.entries(payload || {}).map(([key, value]) => `  ${key}: ${renderValue(value)}`).join('\n');
  if (requiresConfirm) {
    return `Workflow: ${contract.nombre} [riesgo=${contract.riesgo}]\nPayload:\n${fields}\n\nConfirmá con: /confirmar ${execId}`;
  }
  return `Workflow ejecutado: ${contract.nombre}\nPayload:\n${fields}`;
}

module.exports = { parseCommand, argsToPayload, renderPreview };
