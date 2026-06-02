'use strict';

const axios = require('axios');

const TIMEOUT = 10000;

function getBase() {
  return String(process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
}

function getKey() {
  return String(process.env.N8N_API_KEY || '');
}

function isConfigured() {
  return Boolean(getBase() && getKey());
}

function safeErrorCode(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return '401';
  if (error?.code === 'ECONNABORTED') return 'timeout';
  if (status) return String(status);
  return 'other';
}

async function probe() {
  if (!isConfigured()) return { configured: false, reachable: false, baseUrl: null };

  const baseUrl = getBase();
  const key = getKey();
  const t0 = Date.now();

  try {
    const res = await axios.get(`${baseUrl}/healthz`, { timeout: 5000 });
    return {
      configured: true,
      baseUrl,
      reachable: true,
      latencyMs: Date.now() - t0,
      version: res?.data?.version || res?.headers?.['x-n8n-version'] || undefined,
    };
  } catch (_) {
    try {
      const res = await axios.get(`${baseUrl}/api/v1/workflows?limit=1`, {
        headers: { 'X-N8N-API-KEY': key },
        timeout: 5000,
      });
      return {
        configured: true,
        baseUrl,
        reachable: true,
        latencyMs: Date.now() - t0,
        version: res?.headers?.['x-n8n-version'] || undefined,
      };
    } catch (error) {
      return {
        configured: true,
        baseUrl,
        reachable: false,
        latencyMs: Date.now() - t0,
        error: safeErrorCode(error),
      };
    }
  }
}

async function request(config) {
  const baseUrl = getBase();
  const key = getKey();
  if (!isConfigured()) return { ok: false, error: 'n8n_not_configured' };
  try {
    const requestUrl = config.url || `${baseUrl}${config.path}`;
    const response = await axios.request({
      timeout: TIMEOUT,
      validateStatus: () => true,
      ...config,
      url: requestUrl,
      headers: {
        'X-N8N-API-KEY': key,
        ...(config.headers || {}),
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'n8n_auth_failed', status: response.status };
    }
    if (response.status >= 400) {
      return { ok: false, error: 'n8n_upstream_error', status: response.status, data: response.data };
    }
    return { ok: true, status: response.status, data: response.data, headers: response.headers || {} };
  } catch (error) {
    if (error?.code === 'ECONNABORTED') return { ok: false, error: 'n8n_timeout' };
    return { ok: false, error: 'n8n_unreachable', detail: error.message };
  }
}

async function listWorkflows({ limit = 50, active } = {}) {
  if (!isConfigured()) return { ok: false, error: 'n8n_not_configured' };
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (active !== undefined) params.set('active', String(active));
  const result = await request({ method: 'GET', path: `/api/v1/workflows?${params.toString()}` });
  if (!result.ok) return result;
  const data = Array.isArray(result.data?.data) ? result.data.data : [];
  return {
    ok: true,
    workflows: data.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      active: Boolean(workflow.active),
      tags: Array.isArray(workflow.tags) ? workflow.tags.map((tag) => tag?.name || tag).filter(Boolean) : [],
      updatedAt: workflow.updatedAt || null,
    })),
  };
}

async function listExecutions({ workflowId, limit = 20 } = {}) {
  if (!isConfigured()) return { ok: false, error: 'n8n_not_configured' };
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (workflowId) params.set('workflowId', String(workflowId));
  const result = await request({ method: 'GET', path: `/api/v1/executions?${params.toString()}` });
  if (!result.ok) return result;
  const data = Array.isArray(result.data?.data) ? result.data.data : [];
  return {
    ok: true,
    executions: data.map((execution) => ({
      id: execution.id,
      workflowId: execution.workflowId,
      startedAt: execution.startedAt || null,
      stoppedAt: execution.stoppedAt || null,
      status: execution.status || (execution.finished ? (execution.stoppedAt && !execution.data?.resultData?.error ? 'success' : 'error') : 'running'),
      finished: Boolean(execution.finished),
      mode: execution.mode || 'manual',
    })),
  };
}

module.exports = { TIMEOUT, isConfigured, probe, listWorkflows, listExecutions, request };
