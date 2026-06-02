'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '../config/clients');
const RELOAD_INTERVAL = 5 * 60 * 1000;

const DEFAULT_CLIENT = {
  client_id: 1,
  name: 'Roma AI Default',
  company: 'Roma AI',
  prompt_ia: 'Eres un asistente de ventas inteligente de Roma AI. Tu objetivo es capturar leads cualificados, responder preguntas sobre el producto y agendar demos.',
  whatsapp_channel: 'default',
  meta_prefix: '_client',
  active: true,
};

let _cache = null;
let _lastLoad = 0;

function loadClients() {
  const clients = new Map();
  clients.set(1, { ...DEFAULT_CLIENT });

  try {
    if (fs.existsSync(CONFIG_DIR)) {
      fs.readdirSync(CONFIG_DIR)
        .filter(f => f.endsWith('.json'))
        .forEach(file => {
          try {
            const raw = fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8');
            const cfg = JSON.parse(raw);
            if (cfg && cfg.client_id) clients.set(Number(cfg.client_id), cfg);
          } catch (e) {
            console.error('[client-resolver] Error loading', file, e.message);
          }
        });
    }
  } catch (e) {
    console.error('[client-resolver] Error reading config dir:', e.message);
  }

  return clients;
}

function getCache() {
  const now = Date.now();
  if (!_cache || now - _lastLoad > RELOAD_INTERVAL) {
    _cache = loadClients();
    _lastLoad = now;
  }
  return _cache;
}

function resolveClient(req) {
  const cache = getCache();
  const rawId = req.query?.client_id ?? req.body?.client_id ?? null;
  const id = rawId ? Number(rawId) : Number(process.env.WP_DEFAULT_CLIENT_ID || 1);
  const client = cache.get(id);
  if (!client) {
    console.warn('[client-resolver] client_id', id, 'not found, using default');
    return cache.get(1);
  }
  return client;
}

function middleware(req, _res, next) {
  req.client = resolveClient(req);
  next();
}

function getClient(id) {
  return getCache().get(Number(id)) || getCache().get(1);
}

module.exports = { middleware, resolveClient, getClient, loadClients };
