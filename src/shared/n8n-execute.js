'use strict';

const crypto = require('crypto');
const axios = require('axios');
const audit = require('./audit');
const contracts = require('./workflow-contracts');

const pendingExecutions = new Map();
const TTL_MS = 5 * 60 * 1000;
let cleanupTimer = null;

function now() {
  return Date.now();
}

function sanitizeValue(key, value) {
  if (/(token|secret|password|api_?key|authorization|cookie)/i.test(key)) return '***';
  if (/message/i.test(key)) return '***';
  if (value && typeof value === 'object' && !Array.isArray(value)) return sanitizePayload(value);
  if (Array.isArray(value)) return value.map((item) => (item && typeof item === 'object' ? sanitizePayload(item) : item));
  return value;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const copy = {};
  for (const [key, value] of Object.entries(payload)) copy[key] = sanitizeValue(key, value);
  return copy;
}

function truncateBody(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return text.length > 4096 ? `${text.slice(0, 4096)}…` : text;
}

function startCleanupLoop() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = now();
    for (const [execId, item] of pendingExecutions.entries()) {
      if (item.expiresAt <= cutoff) pendingExecutions.delete(execId);
    }
  }, 60 * 1000);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
}

function getActor(context = {}) {
  return {
    ip: context.ip || 'unknown',
    user: context.user || 'session',
  };
}

function logAudit(entry) {
  audit.log({ ts: new Date().toISOString(), ...entry });
}

async function performUpstream(contract, payload, context = {}) {
  const started = now();
  try {
    const response = await axios.request({
      method: contract.metodo || 'POST',
      url: contract.endpoint,
      data: payload,
      timeout: contract.timeout_ms || 10000,
      validateStatus: () => true,
    });
    if (response.status >= 400) {
      return {
        ok: false,
        statusCode: 502,
        error: 'upstream_error',
        upstream: { status: response.status || 0, bodyPreview: truncateBody(response.data) },
      };
    }
    const durMs = now() - started;
    logAudit({
      action: 'n8n_execute',
      workflow_id: contract.id,
      execId: context.execId || null,
      status: 'executed',
      durMs,
      upstreamStatus: response.status,
      ip: context.ip,
      user: context.user,
      payload: sanitizePayload(payload),
    });
    return {
      ok: true,
      durMs,
      upstream: {
        status: response.status,
        body: typeof response.data === 'string' ? truncateBody(response.data) : response.data,
      },
    };
  } catch (error) {
    const code = error?.code === 'ECONNABORTED' ? 504 : 503;
    return { ok: false, statusCode: code, error: code === 504 ? 'upstream_timeout' : 'upstream_unreachable' };
  }
}

async function prepare(workflowId, payload, context = {}) {
  startCleanupLoop();
  const actor = getActor(context);
  const contract = contracts.findById(workflowId);
  if (!contract) return { ok: false, statusCode: 404, body: { ok: false, error: 'unknown_workflow' } };

  const validation = contracts.validatePayload(contract, payload);
  if (!validation.ok) {
    return { ok: false, statusCode: 400, body: { ok: false, error: 'invalid_payload', errors: validation.errors } };
  }

  logAudit({
    action: 'n8n_prepare',
    workflow_id: contract.id,
    status: 'prepared',
    ip: actor.ip,
    user: actor.user,
    payload: sanitizePayload(payload),
  });

  if (!contract.requiere_aprobacion) {
    const execId = crypto.randomUUID();
    const executed = await performUpstream(contract, payload, { ...actor, execId });
    if (!executed.ok) return { ok: false, statusCode: executed.statusCode, body: { ok: false, error: executed.error, upstream: executed.upstream } };
    return {
      ok: true,
      statusCode: 200,
      body: {
        ok: true,
        execId,
        workflow: { id: contract.id, nombre: contract.nombre, riesgo: contract.riesgo },
        upstream: executed.upstream,
        durMs: executed.durMs,
      },
    };
  }

  const execId = crypto.randomUUID();
  const createdAt = now();
  const expiresAt = createdAt + TTL_MS;
  pendingExecutions.set(execId, {
    execId,
    contract,
    payload,
    createdAt,
    expiresAt,
    ip: actor.ip,
    user: actor.user,
  });
  return {
    ok: true,
    statusCode: 202,
    body: {
      ok: true,
      requires_confirmation: true,
      execId,
      workflow: { id: contract.id, nombre: contract.nombre, riesgo: contract.riesgo },
      payload_preview: sanitizePayload(payload),
      expires_in_sec: Math.floor(TTL_MS / 1000),
      confirm_url: `/api/n8n/execute/confirm/${execId}`,
    },
  };
}

async function confirm(execId, confirmed, context = {}) {
  startCleanupLoop();
  const item = pendingExecutions.get(execId);
  if (!item || item.expiresAt <= now()) {
    pendingExecutions.delete(execId);
    return { ok: false, statusCode: 410, body: { ok: false, error: 'exec_expired_or_unknown' } };
  }
  if (confirmed !== true) return { ok: false, statusCode: 400, body: { ok: false, error: 'confirm_required' } };

  pendingExecutions.delete(execId);
  const actor = getActor(context);
  logAudit({
    action: 'n8n_confirm',
    workflow_id: item.contract.id,
    execId,
    status: 'confirmed',
    ip: actor.ip,
    user: actor.user,
  });

  const executed = await performUpstream(item.contract, item.payload, { ...actor, execId });
  if (!executed.ok) return { ok: false, statusCode: executed.statusCode, body: { ok: false, error: executed.error, upstream: executed.upstream } };
  return {
    ok: true,
    statusCode: 200,
    body: {
      ok: true,
      execId,
      workflow: { id: item.contract.id, nombre: item.contract.nombre, riesgo: item.contract.riesgo },
      upstream: executed.upstream,
      durMs: executed.durMs,
    },
  };
}

function listPending(context = {}) {
  startCleanupLoop();
  const actor = getActor(context);
  const list = [];
  for (const item of pendingExecutions.values()) {
    if (item.expiresAt <= now()) continue;
    if (actor.user && item.user && actor.user !== item.user) continue;
    list.push({
      execId: item.execId,
      workflowId: item.contract.id,
      createdAt: new Date(item.createdAt).toISOString(),
      expiresAt: new Date(item.expiresAt).toISOString(),
    });
  }
  return list.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
}

function clearPending() {
  pendingExecutions.clear();
}

module.exports = { prepare, confirm, listPending, clearPending, sanitizePayload, logAudit };
