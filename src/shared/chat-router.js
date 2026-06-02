'use strict';

const sessionContext = require('./session-context');
const prospector = require('../prospecting/prospector');

const AGENT_MAP = {
  '/creativo': 'creativo',
  '/dwm': 'wordpress',
  '/marketing': 'marketing',
  '/soporte': 'soporte',
};

const DEFAULT_PROSPECT_LIMIT = 20;
const AVAILABLE_COMMANDS = [
  '/creativo',
  '/dwm',
  '/marketing',
  '/prospectos',
  '/soporte',
  '/reset',
  '/estado',
];

function parseCommand(message) {
  if (!message || typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) return null;
  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ').trim();
  return { command, args };
}

function getHelpText() {
  return `Comandos disponibles: ${AVAILABLE_COMMANDS.join(', ')}`;
}

function loadAgent(agentName) {
  try {
    return require(`../agents/${agentName}`);
  } catch (e) {
    return null;
  }
}

async function handleAgentTurn(sessionId, agentName, message) {
  const agent = loadAgent(agentName);
  if (!agent || typeof agent.turn !== 'function') {
    sessionContext.reset(sessionId);
    return { reply: 'Agente activo desconocido. Sesión reiniciada.' };
  }
  const result = await agent.turn(sessionId, message);
  return { agent: agent.name, ...result };
}

async function handleAgentStart(sessionId, agentName, message) {
  const agent = loadAgent(agentName);
  if (!agent || typeof agent.start !== 'function') {
    return { reply: `El agente ${agentName} no está disponible.` };
  }
  sessionContext.setAgent(sessionId, agentName);
  const startResult = agent.start(sessionId, message);
  if (agentName === 'soporte' && message) {
    const turnResult = await agent.turn(sessionId, message);
    return { agent: agent.name, ...turnResult };
  }
  return { agent: agent.name, ...startResult };
}

async function route(sessionId, message, channel) {
  const cmd = parseCommand(message);
  if (!cmd) {
    const activeAgent = sessionContext.getAgent(sessionId);
    if (!activeAgent) return null;
    return handleAgentTurn(sessionId, activeAgent, message);
  }

  if (cmd.command === '/reset') {
    sessionContext.reset(sessionId);
    return { reply: 'Sesión reiniciada.' };
  }

  if (cmd.command === '/estado') {
    const ctx = sessionContext.get(sessionId);
    return {
      reply: `Estado de sesión: agente activo=${ctx.agentActive || 'ninguno'}, paso=${ctx.agentStep || 0}`,
      agent: ctx.agentActive || null,
    };
  }

  if (cmd.command === '/prospectos') {
    const query = cmd.args || 'prospecto';
    const result = await prospector.prospectAndSave(String(query), '', DEFAULT_PROSPECT_LIMIT);
    const count = Array.isArray(result) ? result.length : 0;
    return {
      reply: `Prospectos solicitados${count ? `: ${count} guardados` : '.'}`,
      action: 'prospectos',
      brief: result,
    };
  }

  const agentName = AGENT_MAP[cmd.command];
  if (!agentName) {
    return { reply: `Comando desconocido. ${getHelpText()}` };
  }

  return handleAgentStart(sessionId, agentName, cmd.args);
}

module.exports = { route };
