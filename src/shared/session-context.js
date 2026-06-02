'use strict';

const sessions = new Map();

function normalizeSessionId(sessionId) {
  return String(sessionId || 'unknown').trim() || 'unknown';
}

function createSession(sessionId) {
  const now = new Date().toISOString();
  const session = {
    sessionId: normalizeSessionId(sessionId),
    agentActive: null,
    agentStep: 0,
    agentAnswers: [],
    brief: null,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(session.sessionId, session);
  return session;
}

function get(sessionId) {
  const id = normalizeSessionId(sessionId);
  if (!sessions.has(id)) return createSession(id);
  return sessions.get(id);
}

function set(sessionId, patch) {
  const ctx = get(sessionId);
  const now = new Date().toISOString();
  const merged = {
    ...ctx,
    ...patch,
    sessionId: ctx.sessionId,
    updatedAt: now,
  };
  sessions.set(ctx.sessionId, merged);
  return merged;
}

function reset(sessionId) {
  sessions.delete(normalizeSessionId(sessionId));
}

function getAgent(sessionId) {
  const ctx = get(sessionId);
  return ctx.agentActive || null;
}

function setAgent(sessionId, agentName) {
  if (!agentName) return set(sessionId, { agentActive: null });
  return set(sessionId, { agentActive: String(agentName), agentStep: 0, agentAnswers: [], brief: null });
}

module.exports = { get, set, reset, getAgent, setAgent };
