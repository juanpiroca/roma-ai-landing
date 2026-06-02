/**
 * Roma — WhatsApp Bot v4 (Baileys)
 * Captura leads, CRM clientes, planes, admin, audio.
 */
const { loadEnv } = require('../shared/load-env');
loadEnv();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const QRCode = require('qrcode');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { callClaudeWithMemory } = require('../shared/claude');
const { logAction } = require('../shared/action-log');

const AUTH_DIR = path.join(__dirname, '..', '..', 'data', 'wa-auth');
const QR_PATH = path.join(__dirname, '..', '..', 'tmp', 'wa-qr.png');
const TMP_DIR = path.join(__dirname, '..', '..', 'tmp');
const LEADS_DIR = path.join(__dirname, '..', '..', 'data', 'leads');
const PLANS_PATH = path.join(__dirname, '..', '..', 'data', 'plans.json');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

// Roma KB (base de negocio empaquetada)
const ROMA_KB_BUNDLE = process.env.ROMA_KB_BUNDLE || '/home/juanpi/roma/integraciones/roma_kb_bundle.json';
let _kbContextCache = null;
let _kbLoadedAt = 0;
function getRomaKbContext() {
  try {
    const now = Date.now();
    // cache 5 min
    if (_kbContextCache && (now - _kbLoadedAt) < 300000) return _kbContextCache;
    const raw = fs.readFileSync(ROMA_KB_BUNDLE, 'utf8');
    const bundle = JSON.parse(raw);
    const faqCount = Array.isArray(bundle?.faq?.faq) ? bundle.faq.faq.length : 0;
    const intentsCount = Array.isArray(bundle?.intents?.intents) ? bundle.intents.intents.length : 0;
    _kbContextCache = `ROMA_KB_ACTIVA=true\nKB_VERSION=${bundle.version || '1.0'}\nFAQ_COUNT=${faqCount}\nINTENTS_COUNT=${intentsCount}\nREGLA: al cotizar, nunca margen menor a 35%; si faltan datos, pedirlos antes de precio final.`;
    _kbLoadedAt = now;
    return _kbContextCache;
  } catch (_) {
    return 'ROMA_KB_ACTIVA=false';
  }
}

const TTS_VOICE = process.env.ROMA_TTS_VOICE || 'onyx';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VOICE_TOOLS_OPENAI_KEY;
const WHISPER_BIN = process.env.ROMA_WHISPER_BIN || '/usr/local/bin/whisper';
const WHISPER_MODEL = process.env.ROMA_WHISPER_MODEL || '/usr/local/share/whisper-models/ggml-tiny.bin';

// Admin numbers (JuanPi)
const ADMIN_NUMBERS = (process.env.ROMA_ADMIN_NUMBERS || '59177008792,12019696812,59177777777')
  .split(',')
  .map(s => s.replace(/[^0-9]/g, '').trim())
  .filter(Boolean);
const ADMIN_NAME_HINTS = (process.env.ROMA_ADMIN_NAME_HINTS || 'juanpi,juanpi roca,patron,jefecito')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
fs.mkdirSync(LEADS_DIR, { recursive: true });

// ── Cargar planes ──
function getPlans() {
  try { return JSON.parse(fs.readFileSync(PLANS_PATH, 'utf8')).plans; } catch { return []; }
}

// ── Lead system ──
function getLeadFile(sender) {
  const n = sender.replace(/[^0-9]/g, '').slice(-10);
  return path.join(LEADS_DIR, `${n}.json`);
}
function loadLead(sender) {
  try { return JSON.parse(fs.readFileSync(getLeadFile(sender), 'utf8')); } catch { return null; }
}
function saveLead(sender, data) {
  const fp = getLeadFile(sender);
  const ex = loadLead(sender) || { firstContact: new Date().toISOString(), messages: 0 };
  const m = { ...ex, ...data, lastContact: new Date().toISOString(), messages: (ex.messages || 0) + 1 };
  fs.writeFileSync(fp, JSON.stringify(m, null, 2));
  return m;
}
function isAdmin(sender, pushName = '') {
  const n = String(sender || '').replace(/[^0-9]/g, '');
  const normalizedName = String(pushName || '').trim().toLowerCase();
  const byNumber = ADMIN_NUMBERS.some(a => n === a || n.endsWith(a) || a.endsWith(n));
  const byName = normalizedName && ADMIN_NAME_HINTS.some(h => normalizedName.includes(h));
  return byNumber || byName;
}
function listLeads() {
  try {
    return fs.readdirSync(LEADS_DIR).filter(f => f.endsWith('.json')).map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(LEADS_DIR, f), 'utf8')); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}
function getCustomerInfo(nameOrPhone) {
  return listLeads().filter(l =>
    (l.name && l.name.toLowerCase().includes(nameOrPhone.toLowerCase())) ||
    (l.phone && l.phone.includes(nameOrPhone))
  );
}

// ── Audio ──
async function transcribeAudio(audioPath) {
  try {
    const outDir = TMP_DIR;
    const outBase = `wa_${Date.now()}`;
    await execFileAsync(WHISPER_BIN, [
      '-m', WHISPER_MODEL,
      '-f', audioPath,
      '--language', 'es',
      '--output-txt',
      '--output-file', path.join(outDir, outBase),
      '--no-timestamps'
    ], { timeout: 60000 });

    const txtPath = path.join(outDir, `${outBase}.txt`);
    if (!fs.existsSync(txtPath)) return null;
    const text = fs.readFileSync(txtPath, 'utf8').trim();
    setTimeout(() => fs.unlink(txtPath, () => {}), 10000);
    return text || null;
  } catch (err) {
    console.error('[WA] Transcripcion local error:', err.message);
    return null;
  }
}
async function textToSpeech(text) {
  if (!OPENAI_KEY) return null;
  try {
    const res = await axios.post('https://api.openai.com/v1/audio/speech',
      { model: 'tts-1', voice: TTS_VOICE, input: text.slice(0, 4096), response_format: 'ogg' },
      { headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 30000 }
    );
    const ap = path.join(TMP_DIR, `tts_${Date.now()}.ogg`);
    fs.writeFileSync(ap, Buffer.from(res.data));
    return ap;
  } catch (err) { console.error('[WA] TTS error:', err.message); return null; }
}
async function downloadWAFile(msg, mediaType = 'audio') {
  const stream = await downloadMediaMessage(
    msg,
    'buffer',
    {},
    { logger: undefined, reuploadRequest: undefined }
  );
  const ext = mediaType === 'audio' ? 'ogg' : 'bin';
  const f = path.join(TMP_DIR, `wa_${Date.now()}.${ext}`);
  fs.writeFileSync(f, stream);
  return f;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({ auth: state, syncFullHistory: false, browser: ['Roma AI', 'Chrome', '3.0'] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      try { await QRCode.toFile(QR_PATH, qr); console.log(`[WA] QR en tmp/wa-qr.png`); } catch (_) {}
    }
    if (connection === 'open') { console.log('[WA] ✅ Conectado!'); logAction('whatsapp_connected', 'telegram-admin', 'ok', null, {}); }
    if (connection === 'close') {
      const c = lastDisconnect?.error?.output?.statusCode;
      if (c === DisconnectReason.loggedOut) { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); process.exit(1); }
      console.log(`[WA] Desconectado (${c})...`); setTimeout(startBot, 5000);
    }
  });

  sock.ev.on('call', async (calls) => {
    for (const c of calls) {
      try { await sock.rejectCall(c.id, c.from); } catch (_) {}
      try { await sock.sendMessage(c.from, { text: 'No atiendo llamadas, mandame un mensaje.' }); } catch (_) {}
    }
  });

  // ── Admin commands ──
  async function handleAdminCommand(jid, text) {
    const low = text.toLowerCase().trim();
    if (low === '/whoami' || low === 'whoami' || low === '/admin?' || low === 'admin?') {
      const isAdm = isAdmin(jid);
      await sock.sendMessage(jid, { text: `👤 Perfil detectado: ${isAdm ? 'ADMIN' : 'CLIENTE'}\n🆔 Chat: ${jid}` });
      return true;
    }
    if (low === '/clientes' || low === 'clientes' || low === 'lista') {
      const leads = listLeads();
      let r = `📋 *Clientes (${leads.length})*\n\n`;
      leads.slice(-10).reverse().forEach(l => {
        r += `• ${l.name || '?'} | ${l.phone || '?'} | ${l.plan || 'sin plan'} | ${l.stage || 'new'}\n`;
      });
      await sock.sendMessage(jid, { text: r });
      return true;
    }
    if (low.startsWith('/cliente ') || low.startsWith('buscar ')) {
      const q = low.replace(/^\/(cliente|buscar) /, '');
      const found = getCustomerInfo(q);
      if (found.length === 0) { await sock.sendMessage(jid, { text: 'No encontre clientes con ese criterio.' }); return true; }
      let r = `🔍 *${found.length} resultado(s)*\n\n`;
      found.forEach(l => {
        r += `👤 *${l.name || 'Sin nombre'}*\n📱 ${l.phone || '-'}\n📧 ${l.email || '-'}\n📋 Plan: ${l.plan || 'Sin plan'}\n📊 Etapa: ${l.stage || 'new'}\n🕐 Ultimo: ${l.lastContact ? new Date(l.lastContact).toLocaleDateString() : '-'}\n━━━━━━━━━━━\n`;
      });
      await sock.sendMessage(jid, { text: r });
      return true;
    }
    if (low === '/planes' || low === 'planes') {
      const plans = getPlans();
      let r = '📋 *Planes disponibles*\n\n';
      plans.forEach(p => {
        r += `*${p.name}* - ${p.price}\n`;
        p.services.forEach(s => r += `  ✅ ${s}\n`);
        r += '\n';
      });
      await sock.sendMessage(jid, { text: r });
      return true;
    }
    if (low.startsWith('/asignar ')) {
      const parts = low.replace('/asignar ', '').split(' ');
      const phone = parts[0];
      const planId = parts.slice(1).join(' ');
      const leads = listLeads();
      const target = leads.find(l => l.phone && l.phone.includes(phone));
      if (!target) { await sock.sendMessage(jid, { text: 'No encontre cliente con ese telefono.' }); return true; }
      saveLead(target.phone || phone, { plan: planId, stage: 'active' });
      await sock.sendMessage(jid, { text: `✅ Plan "${planId}" asignado a ${target.name || phone}` });
      return true;
    }
    return false;
  }

  // ── Debounce ──
  const pendingTimers = new Map();
  const pendingTexts = new Map();

  async function debouncedProcess(jid, text, hasAudio, pushName = '', senderId = '') {
    const existing = pendingTexts.get(jid) || '';
    pendingTexts.set(jid, existing ? existing + '\n' + text : text);
    if (pendingTimers.has(jid)) clearTimeout(pendingTimers.get(jid));
    pendingTimers.set(jid, setTimeout(async () => {
      pendingTimers.delete(jid);
      const fullText = pendingTexts.get(jid) || text;
      pendingTexts.delete(jid);

      const cleanNum = (senderId || jid).replace(/[^0-9]/g, '').slice(-10);
      const admin = isAdmin(senderId || jid, pushName);
      let lead = loadLead(senderId || jid);

      const adminProbe = fullText.toLowerCase().trim();
      if (adminProbe === '/whoami' || adminProbe === 'whoami' || adminProbe === '/admin?' || adminProbe === 'admin?') {
        await sock.sendMessage(jid, {
          text: `👤 Perfil detectado: ${admin ? 'ADMIN' : 'CLIENTE'}\n🆔 Source: ${senderId || jid}`,
        });
        return;
      }

      // ── Admin commands ──
      if (admin) {
        const handled = await handleAdminCommand(jid, fullText);
        if (handled) return;
      }

      // ── Lead flow progresivo (non-admin) ──
      if (!lead && !admin) {
        // Paso 0: Primer contacto - saludo natural y pedir nombre
        await sock.sendMessage(jid, { text: '👋 Hola! Que gusto tenerte por aca. Como es tu nombre?' });
        saveLead(senderId || jid, { phone: cleanNum, stage: 'new', leadStep: 0 });
        return;
      }
      if (lead && lead.leadStep === 0 && !admin) {
        // Paso 1: Ya nos dijo su nombre - guardarlo, conversar un poco
        const name = fullText.split(/\s+/).slice(0, 2).join(' ').replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        const displayName = name || 'amigo';
        lead = saveLead(senderId || jid, { name: name || 'pendiente', leadStep: 1, stage: 'contacted' });
        // Respuesta natural sin pedir datos todavia - una interaccion mas
        const replies = [
          `Mucho gusto ${displayName}! De que anda buscando o necesitando ayuda?`,
          `Un placer ${displayName}! Contame un poco, que estas necesitando para tu negocio o proyecto?`,
        ];
        await sock.sendMessage(jid, { text: replies[Math.floor(Math.random() * replies.length)] });
        return;
      }
      if (lead && lead.leadStep === 1 && !admin) {
        // Paso 2: Segunda interaccion - ya conversamos, pedir email
        lead = saveLead(senderId || jid, { leadStep: 2 });
        await sock.sendMessage(jid, { text: `Genial! Y ya que estamos, me dejas tu correo para poder enviarte información mas detallada si hace falta?` });
        return;
      }
      if (lead && lead.leadStep === 2 && !admin) {
        // Paso 3: Tercera interaccion - ya tiene email, pedir ciudad
        const email = fullText.trim().includes('@') ? fullText.trim() : 'pendiente';
        lead = saveLead(senderId || jid, { email, leadStep: 3 });
        await sock.sendMessage(jid, { text: `Perfecto! Y de que ciudad y pais nos escribes?` });
        return;
      }
      if (lead && lead.leadStep === 3 && !admin) {
        // Paso 4: Cuarta interaccion - ciudad recibida, completar perfil
        lead = saveLead(senderId || jid, { location: fullText.trim(), leadStep: 4, stage: 'qualified' });
      }

      // ── Build context ──
      let extraCtx = '';
      if (lead) {
        extraCtx = `Cliente: ${lead.name || '?'}, plan: ${lead.plan || 'sin plan'}, etapa: ${lead.stage || 'new'}, email: ${lead.email || '-'}`;
      }
      if (admin) {
        extraCtx = 'Eres Roma, asistiendo a JUANPI (admin). Podes usar comandos como /clientes, /cliente [nombre], /planes, /asignar [telefono] [plan].';
      }
      // Inyectar KB de negocio en todos los casos
      extraCtx = `${extraCtx}\n${getRomaKbContext()}`.trim();

      try {
        const reply = await callClaudeWithMemory(fullText, 'telegram-admin', {
          maxTokens: 400,
          metadata: { chatId: jid, channel: 'whatsapp' },
          extraContext: extraCtx,
        });
        if (reply) {
          const audioPath = hasAudio ? null : await textToSpeech(reply);
          if (audioPath) {
            await sock.sendMessage(jid, { audio: { url: audioPath }, mimetype: 'audio/ogg; codecs=opus' });
            setTimeout(() => fs.unlink(audioPath, () => {}), 5000);
          } else {
            await sock.sendMessage(jid, { text: reply });
          }
          logAction('whatsapp_reply', 'telegram-admin', 'ok', null, { sender: jid });
          if (lead) saveLead(senderId || jid, { lastMessage: reply.slice(0, 100) });
        }
      } catch (err) {
        console.error(`[WA] Error: ${err.message}`);
        try { await sock.sendMessage(jid, { text: 'Ups, algo salio mal.' }); } catch (_) {}
      }
    }, 20000));
  }

  // ── Messages ──
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key?.fromMe || !msg.message) continue;
      const jid = msg.key.remoteJid;
      if (jid.endsWith('@g.us')) continue;
      const pushName = msg.pushName || 'U';
      const sourceId = msg.key.participant || jid;
      const content =
        msg.message?.ephemeralMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message?.viewOnceMessage?.message ||
        msg.message;
      let userText = '';
      let isAudio = false;
      if (content?.conversation || content?.extendedTextMessage) {
        userText = content.conversation || content.extendedTextMessage?.text || '';
      }
      if (content?.audioMessage) {
        isAudio = true;
        try {
          const audioPath = await downloadWAFile(msg, 'audio');
          userText = await transcribeAudio(audioPath);
          setTimeout(() => fs.unlink(audioPath, () => {}), 5000);
        } catch (err) {
          console.error('[WA] Error audio:', err.message);
          userText = '';
        }
        if (!userText) { await sock.sendMessage(jid, { text: 'No entendí el audio. Probá con un audio más corto o texto.' }); continue; }
      }
      if (content?.videoMessage && !content.videoMessage?.gifPlayback) {
        await sock.sendMessage(jid, { text: 'No proceso videos.' }); continue;
      }
      if (!userText && !isAudio) continue;
      const isAdminDetected = isAdmin(sourceId, pushName);
      console.log(`[WA] ${pushName} | jid=${jid} | source=${sourceId} | admin=${isAdminDetected ? 'yes' : 'no'}: ${userText.slice(0, 100)}`);
      debouncedProcess(jid, userText, isAudio, pushName, sourceId);
    }
  });

  console.log('[WA] Roma WhatsApp Bot v4 iniciado.');
  if (!fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    console.log('[WA] Escaneá el QR con WhatsApp.');
  }
}
startBot().catch(err => { console.error('[WA] Fatal:', err); process.exit(1); });
