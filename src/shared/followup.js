const fs = require('fs');
const path = require('path');
const axios = require('axios');
const whatsapp = require('../whatsapp-bridge/whatsapp');

const LEADS_DIR = path.join(__dirname, '../../data/leads');
const FOLLOWUPS_FILE = path.join(__dirname, '../../data/followups.json');
const FOLLOWUP_1_DELAY = 24 * 60 * 60 * 1000;
const FOLLOWUP_2_DELAY = 72 * 60 * 60 * 1000;

function getFollowupMessage(lead, attempt) {
  const isEnglish = lead.language === 'en';
  if (attempt === 1) {
    return isEnglish
      ? 'Hey! I was thinking about what you told me. Did you get a chance to consider it?'
      : 'Hola, estuve pensando en lo que me contaste. ¿Pudiste pensarlo?';
  }
  return isEnglish
    ? "Just checking in one last time. If the timing isn't right, no worries at all - I'm here when you're ready."
    : 'Paso a saludarte una ultima vez. Si el momento no es el indicado, sin problema - aca estoy cuando quieras.';
}

function readAllLeads() {
  try {
    return fs.readdirSync(LEADS_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(LEADS_DIR, name), 'utf8'));
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function updateLead(lead) {
  const safe = String(lead.sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safe) return;
  fs.mkdirSync(LEADS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(LEADS_DIR, `${safe}.json`),
    JSON.stringify({ ...lead, updatedAt: new Date().toISOString() }, null, 2)
  );
}

function readScheduledFollowups() {
  try {
    return JSON.parse(fs.readFileSync(FOLLOWUPS_FILE, 'utf8'));
  } catch (_) {
    return { followups: [] };
  }
}

function writeScheduledFollowups(data) {
  fs.mkdirSync(path.dirname(FOLLOWUPS_FILE), { recursive: true });
  fs.writeFileSync(FOLLOWUPS_FILE, JSON.stringify(data, null, 2));
}

function localHour(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === 'hour')?.value || 0);
}

function nextLocalTen(date, tz) {
  const next = new Date(date.getTime());
  do {
    next.setTime(next.getTime() + 60 * 60 * 1000);
  } while (localHour(next, tz) !== 10);
  return next;
}

function scheduleRespectingHours(leadId, stage, tz = 'America/Argentina/Buenos_Aires', from = new Date()) {
  const delay = stage === 'idle_72' ? FOLLOWUP_2_DELAY : FOLLOWUP_1_DELAY;
  let runAt = new Date(from.getTime() + delay);
  const hour = localHour(runAt, tz);
  if (hour < 9 || hour >= 21) runAt = nextLocalTen(runAt, tz);
  const data = readScheduledFollowups();
  data.followups = (data.followups || []).filter((f) => !(f.leadId === leadId && f.stage === stage));
  data.followups.push({ leadId, stage, tz, runAt: runAt.toISOString(), createdAt: new Date().toISOString() });
  writeScheduledFollowups(data);
  return { leadId, stage, tz, runAt: runAt.toISOString() };
}

async function sendWhatsAppFollowup(sessionId, text) {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  if (!token || !phoneId || !String(sessionId).startsWith('wa_')) return false;

  const to = String(sessionId).replace(/^wa_/, '');
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return true;
  } catch (e) {
    fs.appendFileSync(path.join(process.cwd(), 'error_log.txt'), `[followup] ${e.message}\n`);
    return false;
  }
}

async function runFollowups() {
  const now = Date.now();
  const leads = readAllLeads();

  for (const lead of leads) {
    const stage = String(lead.stage || '').toLowerCase();
    const sessionId = String(lead.sessionId || '');
    // lastInboundAt = último mensaje del cliente (no de Roma)
    const lastActivity = lead.lastInboundAt || lead.updatedAt;
    const lastActivityTs = lastActivity ? new Date(lastActivity).getTime() : NaN;
    const followupCount = Number(lead.followupCount || 0);

    if (!sessionId.startsWith('wa_')) continue;
    if (['closed', 'cold', 'cleared'].includes(stage)) continue;
    if (!Number.isFinite(lastActivityTs)) continue;

    const elapsed = now - lastActivityTs;

    if (followupCount === 0 && elapsed >= FOLLOWUP_1_DELAY) {
      const sent = await sendWhatsAppFollowup(sessionId, getFollowupMessage(lead, 1));
      if (sent) {
        lead.followupCount = 1;
        lead.followup1At = new Date().toISOString();
        updateLead(lead);
        console.log(`[followup] intento 1 enviado a ${sessionId}`);
      }
      continue;
    }

    if (followupCount === 1 && elapsed >= FOLLOWUP_2_DELAY) {
      const sent = await sendWhatsAppFollowup(sessionId, getFollowupMessage(lead, 2));
      if (sent) {
        lead.followupCount = 2;
        lead.followup2At = new Date().toISOString();
        lead.stage = 'cold';
        updateLead(lead);
        console.log(`[followup] intento 2 enviado a ${sessionId} - marcado cold`);
      }
    }
  }
}

async function processPending() {
  const data = readScheduledFollowups();
  const followups = Array.isArray(data) ? data : (data.followups || []);
  const now = Date.now();
  let sent = 0;
  let failed = 0;

  for (const item of followups) {
    if (item.sent || item.failed) continue;
    const scheduledTs = new Date(item.runAt || item.scheduledAt || 0).getTime();
    if (!Number.isFinite(scheduledTs) || scheduledTs > now) continue;
    const lead = readAllLeads().find((entry) => entry.sessionId === item.leadId);
    const attempt = item.stage === 'idle_72' ? 2 : 1;
    const body = item.body || getFollowupMessage(lead || {}, attempt);
    const target = String(item.to || item.leadId || '').replace(/^wa_/, '');
    try {
      await whatsapp.sendText(target, body);
      item.sent = true;
      item.sentAt = new Date().toISOString();
      sent += 1;
    } catch (error) {
      item.retries = Number(item.retries || 0) + 1;
      item.last_error = error.message || 'send_failed';
      if (item.retries >= 3) item.failed = true;
      failed += 1;
    }
  }

  writeScheduledFollowups(Array.isArray(data) ? followups : { ...data, followups });
  return { ok: true, sent, failed, pending: followups.filter((item) => !item.sent && !item.failed).length };
}

module.exports = { runFollowups, getFollowupMessage, scheduleRespectingHours, processPending };
