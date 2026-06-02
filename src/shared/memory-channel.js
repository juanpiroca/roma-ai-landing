// Canal de Memoria — puente bidireccional WordPress ↔ Dashboard Roma
// Usa archivo plano JSON en data/ (sin DB)

const fs = require('fs');
const path = require('path');

const CHANNEL_FILE = path.join(__dirname, '../../data/memory-channel.json');
const LEADS_DIR = path.join(__dirname, '../../data/leads');

function _read() {
  try {
    return JSON.parse(fs.readFileSync(CHANNEL_FILE, 'utf8'));
  } catch {
    return { entries: [], last_updated: null };
  }
}

function _write(data) {
  data.last_updated = new Date().toISOString();
  fs.writeFileSync(CHANNEL_FILE, JSON.stringify(data, null, 2));
}

// WordPress escribe avances aquí
function writeEntry(source, payload) {
  const data = _read();
  data.entries.unshift({ source, payload, ts: new Date().toISOString() });
  if (data.entries.length > 50) data.entries = data.entries.slice(0, 50); // max 50
  _write(data);
}

// Dashboard Roma lee el contexto más reciente
function readRecent(limit = 10) {
  return _read().entries.slice(0, limit);
}

// Claude Code puede leer esto para saber qué hizo WP sin que el usuario explique
function getContext() {
  const entries = readRecent(5);
  if (!entries.length) return 'Sin actividad reciente en el canal WP→Roma.';
  return entries.map(e => `[${e.ts.slice(0, 16)}] ${e.source}: ${JSON.stringify(e.payload)}`).join('\n');
}

function readLeads() {
  try {
    return fs.readdirSync(LEADS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const lead = JSON.parse(fs.readFileSync(path.join(LEADS_DIR, f), 'utf8'));
          return { ...lead, sessionId: lead.sessionId || f.replace(/\.json$/, '') };
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function findLeadByExternalId(channel, externalId) {
  const id = channel === 'whatsapp' && !String(externalId).startsWith('wa_') ? `wa_${externalId}` : String(externalId);
  return readLeads().find((lead) => lead.sessionId === id || lead.externalId === externalId) || null;
}

function tokenScore(a, b) {
  const left = new Set(String(a || '').toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(Boolean));
  const right = new Set(String(b || '').toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(Boolean));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.max(left.size, right.size);
}

async function findLeadByPhoneOrFuzzy({ phone, email, name, project } = {}) {
  const leads = readLeads();
  if (phone) {
    const normalized = String(phone).replace(/\D/g, '');
    const found = leads.find((lead) => String(lead.phone || lead.sessionId || '').replace(/\D/g, '').includes(normalized));
    if (found) return found;
  }
  if (email) {
    const found = leads.find((lead) => String(lead.email || '').toLowerCase() === String(email).toLowerCase());
    if (found) return found;
  }
  let best = null;
  for (const lead of leads) {
    const score = tokenScore(name, lead.name) * 0.6 + tokenScore(project, lead.project || lead.category) * 0.4;
    if (score >= 0.7 && (!best || score > best.score)) best = { score, lead };
  }
  return best ? best.lead : null;
}

module.exports = { writeEntry, readRecent, getContext, findLeadByExternalId, findLeadByPhoneOrFuzzy };
