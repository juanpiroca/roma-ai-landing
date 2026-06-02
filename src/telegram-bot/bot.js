/**
 * Roma — Telegram Bot v2
 * Recibe texto, voz, audio, documentos, imágenes, video y links.
 * Responde como humano (corto y directo). Solo Claude.
 * Modo de respuesta por chat: texto o audio.
 * Enruta comandos con autorización. Seguridad fuerte.
 */

const TelegramBot = require('node-telegram-bot-api');
const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../shared/load-env');
const { inspectCommand, validateRequiredEnv, getAudioEnvStatus } = require('../shared/security');
const { createMailTransport } = require('../shared/mailer');
const { callClaudeWithMemory } = require('../shared/claude');
const memory = require('../shared/memory');
const { logAction } = require('../shared/action-log');
const { getChatState, updateChatState } = require('../shared/telegram-state');
const { exportConversation } = require('../shared/doc-export');
const { extractTextFromDocument, analyzeImageWithClaude, isImageMime } = require('../shared/file-analysis');
const {
  isAuthorizedChat,
  canProcessAttachments,
  isAllowedDocumentFile,
} = require('../shared/telegram-policy');

loadEnv();

// Modo texto es siempre el default — audio no persiste entre reinicios
const { resetAllModesToText } = require('../shared/telegram-state');
resetAllModesToText();

const config = require('../../config/roma.config.json');
const {
  OPENAI_API_KEY,
  GMAIL_USER,
  GMAIL_PASS,
  ALLOWED_CHAT_ID,
  TELEGRAM_CHAT_ID,
} = process.env;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

const envStatus = validateRequiredEnv('bot');
if (!envStatus.ok) {
  const problems = [
    envStatus.missing.length ? `faltan variables: ${envStatus.missing.join(', ')}` : null,
    envStatus.invalid.length ? `variables inválidas: ${envStatus.invalid.join(', ')}` : null,
  ].filter(Boolean);
  console.error(`Roma Bot no puede iniciar. ${problems.join(' | ')}`);
  process.exit(1);
}

// ── Webhook ───────────────────────────────────────────────────
const WEBHOOK_URL = `${process.env.PUBLIC_BASE_URL || ''}/telegram/webhook`;
const usePolling = !process.env.PUBLIC_BASE_URL;
const bot = new TelegramBot(TELEGRAM_TOKEN, usePolling ? { polling: true } : { webHook: false });
bot.setMyCommands([
  { command: 'leads', description: 'Ver leads activos' },
  { command: 'health', description: 'Estado del servidor' },
  { command: 'logs', description: 'Últimos errores' },
  { command: 'doc', description: 'Exportar chat en MD y PDF' },
  { command: 'reiniciar', description: 'Reiniciar Roma' },
  { command: 'audio', description: 'Activar respuestas de voz' },
  { command: 'texto', description: 'Volver a respuestas de texto' },
]).catch(() => { });
bot.on('polling_error', (error) => {
  console.error('[Telegram] polling_error:', error?.code || error?.message || error);
  // EFATAL: restart polling automatically
  if (error?.code === 'EFATAL' || error?.message?.includes('EFATAL')) {
    console.log('[Telegram] EFATAL detectado, reiniciando polling en 3s...');
    setTimeout(() => {
      try {
        bot.stopPolling().catch(() => {});
        setTimeout(() => {
          bot.startPolling().catch(e => console.error('[Telegram] restart fail:', e.message));
        }, 1000);
      } catch (e) {
        console.error('[Telegram] error restart:', e.message);
      }
    }, 3000);
  }
});

async function registerWebhook() {
  try {
    const info = await bot.getWebHookInfo();
    if (info.url === WEBHOOK_URL) {
      console.log(`[bot] Webhook ya registrado: ${WEBHOOK_URL}`);
      return;
    }
    await bot.setWebHook(WEBHOOK_URL, { drop_pending_updates: true });
    console.log(`[bot] Webhook registrado: ${WEBHOOK_URL}`);
  } catch (e) {
    console.error('[bot] Error registrando webhook:', e.message);
    setTimeout(registerWebhook, 15000);
  }
}
if (!usePolling) {
  registerWebhook();
}
console.log(`Roma Bot activo (${usePolling ? 'polling' : 'webhook'})...`);

// ── Pendientes de autorización ────────────────────────────────
const pendingAuths = new Map();

// ── Carpeta segura de descargas ───────────────────────────────
const SAFE_TMP = path.resolve('/home/juanpi/Roma/tmp');
if (!fs.existsSync(SAFE_TMP)) fs.mkdirSync(SAFE_TMP, { recursive: true });

// Límites de tamaño en bytes
const LIMITS = {
  document: 20 * 1024 * 1024,  // 20 MB
  image: 10 * 1024 * 1024,  // 10 MB
  audio: 25 * 1024 * 1024,  // 25 MB
  voice: 25 * 1024 * 1024,  // 25 MB
  video: 50 * 1024 * 1024,  // 50 MB
};

const TTS_VOICE = process.env.ROMA_TTS_VOICE || 'nova';

// ── Claude ────────────────────────────────────────────────────
async function callClaude(prompt) {
  return callClaudeWithMemory(prompt, 'telegram', {
    emptyMessage: 'No entendí el mensaje, mandame algo de nuevo.',
    maxTokens: 400,
  });
}

// ── TTS ───────────────────────────────────────────────────────
async function replyWithAudio(chatId, text) {
  const tmpPath = path.join(SAFE_TMP, `tts_${Date.now()}.mp3`);
  const audioEnv = getAudioEnvStatus();
  if (!audioEnv.ok) {
    logAction('telegram_tts_send', 'telegram-admin', 'fallback_text', audioEnv.reason, { chatId, voice: TTS_VOICE });
    return bot.sendMessage(chatId, text);
  }
  try {
    logAction('telegram_tts_start', 'telegram-admin', 'started', null, { chatId });
    const res = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      { model: 'tts-1', voice: TTS_VOICE, input: text, response_format: 'mp3' },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
    );
    fs.writeFileSync(tmpPath, Buffer.from(res.data));
    await bot.sendVoice(chatId, tmpPath);
    logAction('telegram_tts_send', 'telegram-admin', 'ok', null, { chatId, voice: TTS_VOICE });
  } catch (err) {
    console.error('TTS error:', err?.response?.data || err.message);
    logAction('telegram_tts_send', 'telegram-admin', 'fallback_text', err.message, { chatId, voice: TTS_VOICE });
    await bot.sendMessage(chatId, text);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) { }
  }
}

// ── Respuesta al usuario (respeta modo por chat) ──────────────
// isSystem = true → siempre texto (errores, avisos de sistema, cambios)
async function replyToUser(chatId, text, isSystem = false) {
  const state = getChatState(chatId);
  if (!isSystem) updateChatState(chatId, { lastAssistantText: text });
  if (isSystem || state.responseMode === 'text') {
    return bot.sendMessage(chatId, text);
  }
  return replyWithAudio(chatId, text);
}

// ── Whisper ───────────────────────────────────────────────────
async function transcribeAudio(filePath) {
  const audioEnv = getAudioEnvStatus();
  if (!audioEnv.ok) {
    throw new Error(audioEnv.reason);
  }
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${OPENAI_API_KEY}` }
  });
  return res.data.text;
}

// ── Email ─────────────────────────────────────────────────────
async function sendEmail(subject, body) {
  const transporter = createMailTransport({ GMAIL_USER, GMAIL_PASS });
  if (!transporter) return;
  await transporter.sendMail({
    from: `Roma <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject: `[Roma] ${subject}`,
    text: body
  });
}

// continueSellerSession removido — ventas van por web chat y WhatsApp, no Telegram

// ── Auth ──────────────────────────────────────────────────────
function isAuthorized(chatId) {
  return isAuthorizedChat(chatId);
}

// ── Descarga segura de archivos de Telegram ──────────────────
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

async function downloadTelegramFile(fileId, prefix, maxBytes) {
  const file = await bot.getFile(fileId);
  const fileSize = file.file_size || 0;
  if (fileSize > maxBytes) {
    throw new Error(`Archivo demasiado grande: ${(fileSize / 1024 / 1024).toFixed(1)} MB (máx ${maxBytes / 1024 / 1024} MB)`);
  }
  const remotePath = file.file_path;
  if (/\.\./.test(remotePath)) throw new Error('Path inválido');
  const ext = path.extname(remotePath) || '';
  const localPath = path.join(SAFE_TMP, `${prefix}_${Date.now()}${sanitizeFilename(ext)}`);
  if (!localPath.startsWith(SAFE_TMP)) throw new Error('Destino fuera del área permitida');
  const url = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${remotePath}`;
  const response = await axios({ url, responseType: 'stream', timeout: 30000 });
  const writer = fs.createWriteStream(localPath);
  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  return localPath;
}

function getExportEntries(chatId) {
  return memory.getAllHistory(500)
    .filter((entry) => entry.channel === 'telegram-admin' && String(entry.chatId || '') === String(chatId))
    .slice(-80)
    .map((entry) => ({ role: entry.role, content: entry.content, ts: entry.ts }));
}

// ── Dispatch Claude reply (texto, exec, plan) ─────────────────
async function handleClaudeReply(chatId, reply) {
  let parsed = null;
  try {
    const match = reply.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch (_) { }

  if (parsed && parsed.action === 'exec' && parsed.cmd) {
    const inspection = inspectCommand(parsed.cmd);
    if (!inspection.ok) {
      logAction('telegram_exec_blocked', 'telegram-admin', 'blocked', inspection.reason, { chatId, cmd: parsed.cmd });
      return replyToUser(chatId, `Bloqueado por seguridad: ${inspection.reason}`, true);
    }
    try {
      const { exec } = require('child_process');
      logAction('telegram_exec', 'telegram-admin', 'started', null, { chatId, cmd: parsed.cmd });
      const output = await new Promise((resolve) => {
        exec(parsed.cmd, { cwd: '/home/juanpi/Roma', timeout: 30000 }, (err, stdout, stderr) => {
          const result = (stdout || '') + (stderr ? `\nSTDERR: ${stderr}` : '');
          resolve(err ? `Error: ${err.message}\n${result}` : result || '(sin output)');
        });
      });

      const preview = output.slice(0, 800);
      logAction('telegram_exec', 'telegram-admin', 'ok', null, { chatId, cmd: parsed.cmd });
      await bot.sendMessage(chatId, `✅ Ejecutado:\n\`${parsed.cmd}\`\n\n\`\`\`\n${preview}\n\`\`\``, { parse_mode: 'Markdown' });
      return replyToUser(chatId, `Listo, ejecuté el comando. ${output.slice(0, 100)}`);
    } catch (err) {
      console.error('exec error:', err.message);
      logAction('telegram_exec', 'telegram-admin', 'error', err.message, { chatId, cmd: parsed.cmd });
      return replyToUser(chatId, `Hubo un error ejecutando: ${err.message.slice(0, 100)}`, true);
    }
  }

  if (parsed && parsed.action === 'plan' && parsed.content) {
    const planFile = path.join('/home/juanpi/Roma/trabajo', `PLAN_${Date.now()}.md`);
    try {
      fs.writeFileSync(planFile, parsed.content, 'utf8');
      return replyToUser(chatId, `Plan guardado en trabajo/. Título: ${parsed.title || 'sin título'}`);
    } catch (err) {
      console.error('plan write error:', err.message);
      return replyToUser(chatId, 'No pude guardar el plan: ' + err.message, true);
    }
  }

  return replyToUser(chatId, reply);
}

// ── Input handlers modulares ──────────────────────────────────

async function handleDocumentInput(chatId, doc) {
  const mime = doc.mime_type || '';
  if (!canProcessAttachments(chatId)) {
    logAction('telegram_attachment_ignored', 'telegram-admin', 'ignored', null, { chatId, kind: 'document' });
    return;
  }
  if (!isAllowedDocumentFile(doc)) {
    logAction('telegram_document_rejected', 'telegram-admin', 'blocked', null, { chatId, mime, fileName: doc.file_name || '' });
    return replyToUser(chatId, `Tipo de archivo no permitido: ${mime || path.extname(doc.file_name || '') || 'desconocido'}`, true);
  }
  let localPath;
  try {
    localPath = await downloadTelegramFile(doc.file_id, 'doc', LIMITS.document);
  } catch (err) {
    logAction('telegram_document_download', 'telegram-admin', 'error', err.message, { chatId, fileName: doc.file_name || '' });
    return replyToUser(chatId, `No pude descargar el archivo: ${err.message}`, true);
  }
  let content = '';
  try {
    content = extractTextFromDocument(localPath, mime, doc.file_name || '').slice(0, 4000);
  } catch (err) {
    content = `[No pude leer el archivo: ${err.message}]`;
  } finally {
    try { fs.unlinkSync(localPath); } catch (_) { }
  }
  logAction('telegram_document_process', 'telegram-admin', 'ok', null, { chatId, mime, fileName: doc.file_name || '' });
  const prompt = `El usuario envió un documento (${doc.file_name || 'sin nombre'}, tipo: ${mime}).\nContenido:\n${content}\n\nRespondé en forma concisa y útil.`;
  const reply = await callClaudeWithMemory(prompt, 'telegram-admin', { maxTokens: 400, metadata: { chatId } });
  return handleClaudeReply(chatId, reply);
}

async function handleImageInput(chatId, photos, caption) {
  if (!canProcessAttachments(chatId)) {
    logAction('telegram_attachment_ignored', 'telegram-admin', 'ignored', null, { chatId, kind: 'image' });
    return;
  }
  const photo = photos[photos.length - 1];
  if ((photo.file_size || 0) > LIMITS.image) {
    return replyToUser(chatId, `Imagen demasiado grande (máx ${LIMITS.image / 1024 / 1024} MB)`, true);
  }
  let localPath;
  try {
    localPath = await downloadTelegramFile(photo.file_id, 'img', LIMITS.image);
  } catch (err) {
    logAction('telegram_image_download', 'telegram-admin', 'error', err.message, { chatId });
    return replyToUser(chatId, `No pude descargar la imagen: ${err.message}`, true);
  }
  try {
    const reply = await analyzeImageWithClaude({
      filePath: localPath,
      mime: 'image/jpeg',
      fileName: `telegram-photo-${photo.file_unique_id || Date.now()}.jpg`,
      caption,
      metadata: { chatId },
    });
    logAction('telegram_image_process', 'telegram-admin', 'ok', null, { chatId, hasCaption: Boolean(caption) });
    return handleClaudeReply(chatId, reply);
  } catch (err) {
    logAction('telegram_image_process', 'telegram-admin', 'error', err.message, { chatId });
    return replyToUser(chatId, `No pude analizar la imagen: ${err.message}`, true);
  } finally {
    try { fs.unlinkSync(localPath); } catch (_) { }
  }
}

async function handleAudioFileInput(chatId, fileId, limitKey) {
  if (!canProcessAttachments(chatId)) {
    logAction('telegram_attachment_ignored', 'telegram-admin', 'ignored', null, { chatId, kind: limitKey });
    return;
  }
  let localPath;
  try {
    localPath = await downloadTelegramFile(fileId, limitKey, LIMITS[limitKey]);
  } catch (err) {
    return replyToUser(chatId, `No pude descargar el audio: ${err.message}`, true);
  }
  let transcript = '';
  try {
    logAction('telegram_audio_transcription', 'telegram-admin', 'started', null, { chatId, kind: limitKey });
    transcript = await transcribeAudio(localPath);
  } catch (err) {
    logAction('telegram_audio_transcription', 'telegram-admin', 'error', err.message, { chatId, kind: limitKey });
    return replyToUser(chatId, `No pude transcribir el audio: ${err.message}`, true);
  } finally {
    try { fs.unlinkSync(localPath); } catch (_) { }
  }
  if (!transcript || !transcript.trim()) {
    return replyToUser(chatId, 'No escuché nada, ¿me repetís eso?');
  }
  logAction('telegram_audio_transcription', 'telegram-admin', 'ok', null, { chatId, kind: limitKey });
  const reply = await callClaudeWithMemory(transcript, 'telegram-admin', { maxTokens: 400, metadata: { chatId } });
  return handleClaudeReply(chatId, reply);
}

async function handleVideoInput(chatId, video, caption) {
  if (!canProcessAttachments(chatId)) {
    logAction('telegram_attachment_ignored', 'telegram-admin', 'ignored', null, { chatId, kind: 'video' });
    return;
  }
  if ((video.file_size || 0) > LIMITS.video) {
    return replyToUser(chatId, `Video demasiado grande (máx ${LIMITS.video / 1024 / 1024} MB). Enviá la descripción o un clip corto.`, true);
  }
  const duration = video.duration ? `${video.duration}s` : 'desconocida';
  const prompt = caption
    ? `El usuario envió un video (duración: ${duration}) con descripción: "${caption}". Respondé sobre el contenido.`
    : `El usuario envió un video de ${duration}. Pedile que describa qué necesita.`;
  const reply = await callClaudeWithMemory(prompt, 'telegram-admin', { maxTokens: 300, metadata: { chatId } });
  return handleClaudeReply(chatId, reply);
}

async function handleAdminMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (text === '/audio') {
    const audioEnv = getAudioEnvStatus();
    if (!audioEnv.ok) {
      logAction('telegram_mode_change', 'telegram-admin', 'audio_unavailable', audioEnv.reason, { chatId });
      return bot.sendMessage(chatId, `No puedo activar audio todavía: ${audioEnv.reason}. Mientras tanto sigo en texto.`);
    }
    updateChatState(chatId, { responseMode: 'audio' });
    logAction('telegram_mode_change', 'telegram-admin', 'audio', null, { chatId });
    return bot.sendMessage(chatId, '🎤 Modo audio activado. Te respondo con voz.');
  }
  if (text === '/texto') {
    updateChatState(chatId, { responseMode: 'text' });
    logAction('telegram_mode_change', 'telegram-admin', 'text', null, { chatId });
    return bot.sendMessage(chatId, '💬 Modo texto activado.');
  }

  if (text === '/leads' || text === '/leads hoy') {
    try {
      const leadsDir = path.join(process.cwd(), 'data', 'leads');
      const files = fs.readdirSync(leadsDir).filter((name) => name.endsWith('.json'));
      const leads = files.map((name) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(leadsDir, name), 'utf8'));
        } catch (_) {
          return null;
        }
      }).filter(Boolean);
      const active = leads.filter((lead) => !['cold', 'cleared'].includes(lead.stage));
      const msg2 = active.length
        ? active.map((lead) => `• ${lead.id?.replace('wa_', '')} — ${lead.stage} (${lead.exchanges} msgs)${lead.email ? ' ✉️' : ''}`).join('\n')
        : 'Sin leads activos por ahora.';
      logAction('telegram_leads', 'telegram-admin', 'ok', null, { chatId, count: active.length });
      return bot.sendMessage(chatId, `👥 *Leads activos: ${active.length}*\n${msg2}`, { parse_mode: 'Markdown' });
    } catch (e) {
      logAction('telegram_leads', 'telegram-admin', 'error', e.message, { chatId });
      return bot.sendMessage(chatId, `Error leyendo leads: ${e.message}`);
    }
  }

  if (text === '/health' || text === '/status') {
    try {
      const res = await axios.get('http://localhost:3010/api/health', {
        headers: { 'X-Auth-Token': process.env.DASHBOARD_TOKEN || process.env.ADMIN_TOKEN || 'roma2026' }
      });
      const d = res.data;
      const upH = Math.floor(d.uptime / 3600);
      const upM = Math.floor((d.uptime % 3600) / 60);
      logAction('telegram_health', 'telegram-admin', 'ok', null, { chatId });
      return bot.sendMessage(chatId, `🟢 *Roma activa* — up ${upH}h${upM}m\nWhatsApp: ${d.services.whatsapp.ok ? '✅' : '❌'}\nLeads: ${d.services.leads.count}\nRAM: ${d.services.memory.heapMB}MB`, { parse_mode: 'Markdown' });
    } catch (e) {
      logAction('telegram_health', 'telegram-admin', 'error', e.message, { chatId });
      return bot.sendMessage(chatId, `No pude leer el health: ${e.message}`);
    }
  }

  if (text === '/logs') {
    try {
      const logFile = path.join(process.cwd(), 'error_log.txt');
      const content = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
      const lines = content.trim().split('\n').filter(Boolean).slice(-10);
      logAction('telegram_logs', 'telegram-admin', 'ok', null, { chatId, count: lines.length });
      return bot.sendMessage(chatId, lines.length ? `📋 Últimos errores:\n\`\`\`\n${lines.join('\n')}\n\`\`\`` : '✅ Sin errores recientes.', { parse_mode: 'Markdown' });
    } catch (e) {
      logAction('telegram_logs', 'telegram-admin', 'error', e.message, { chatId });
      return bot.sendMessage(chatId, `Error: ${e.message}`);
    }
  }

  if (text.startsWith('/doc')) {
    const title = text.replace('/doc', '').trim() || `roma-chat-${chatId}`;
    const entries = getExportEntries(chatId);
    if (!entries.length) {
      return bot.sendMessage(chatId, 'No tengo conversación suficiente para exportar todavía.');
    }
    try {
      const exported = exportConversation(title, entries);
      logAction('telegram_doc_export', 'telegram-admin', 'ok', null, { chatId, title });
      await bot.sendDocument(chatId, exported.mdPath, {}, { filename: path.basename(exported.mdPath), contentType: 'text/markdown' });
      await bot.sendDocument(chatId, exported.pdfPath, {}, { filename: path.basename(exported.pdfPath), contentType: 'application/pdf' });
      return;
    } catch (e) {
      logAction('telegram_doc_export', 'telegram-admin', 'error', e.message, { chatId, title });
      return bot.sendMessage(chatId, `No pude generar el documento: ${e.message}`);
    }
  }

  if (text === '/reiniciar' || text === '/restart') {
    logAction('telegram_restart', 'telegram-admin', 'requested', null, { chatId });
    bot.sendMessage(chatId, '🔄 Reiniciando Roma...');
    setTimeout(() => { process.exit(0); }, 1000);
    return;
  }

  const reply = await callClaudeWithMemory(text, 'telegram-admin', { maxTokens: 400, metadata: { chatId } });
  logAction('telegram_admin_reply', 'telegram-admin', getChatState(chatId).responseMode, null, { chatId });
  return replyToUser(chatId, reply);
}

// ── Handler principal ─────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) {
    if (msg.document || msg.photo || msg.audio || msg.video || msg.voice) {
      logAction('telegram_unauthorized_attachment', 'telegram-admin', 'ignored', null, { chatId });
      return;
    }
    logAction('telegram_unauthorized_message', 'telegram-admin', 'blocked', null, { chatId });
    return bot.sendMessage(
      chatId,
      'Acceso no autorizado.'
    );
  }

  const state = getChatState(chatId);
  const text = (msg.text || '').trim();

  // ── Modo de respuesta ─────────────────────────────────────────
  if (/respond[eé].*texto/i.test(text) && !/audio/i.test(text)) {
    updateChatState(chatId, { responseMode: 'text' });
    return bot.sendMessage(chatId, '✅ Ta bien, ya respondo en texto pues.');
  }
  if (/respond[eé].*audio/i.test(text) && !/texto/i.test(text)) {
    updateChatState(chatId, { responseMode: 'audio' });
    return bot.sendMessage(chatId, '✅ De una, respondo con voz.');
  }

  // ── "me lo pasas en texto" — sin cambiar el modo ──────────────
  if (/^(me lo pas[aá]s en texto|pas[aá]melo en texto|pas[aá]lo en texto)$/i.test(text)) {
    const last = state.lastAssistantText;
    if (!last) return bot.sendMessage(chatId, 'Mira pues, no hay mensaje anterior. ¿Me volvés a preguntar?');
    return bot.sendMessage(chatId, last);
  }

  // ── Auth responses ────────────────────────────────────────────
  if (text.startsWith('/auth_ok_')) {
    const id = text.replace('/auth_ok_', '');
    const p = pendingAuths.get(id);
    if (p) { pendingAuths.delete(id); return bot.sendMessage(chatId, `✅ Autorizado: ${p.action}`); }
    return bot.sendMessage(chatId, '⚠️ ID no encontrado.');
  }
  if (text.startsWith('/auth_no_')) {
    const id = text.replace('/auth_no_', '');
    const p = pendingAuths.get(id);
    if (p) { pendingAuths.delete(id); return bot.sendMessage(chatId, `❌ Rechazado: ${p.action}`); }
    return bot.sendMessage(chatId, '⚠️ ID no encontrado.');
  }

  // ── VS Code hook approvals ────────────────────────────────────
  if (text.startsWith('/hook_ok_') || text.startsWith('/hook_no_')) {
    const approved = text.startsWith('/hook_ok_');
    const id = text.replace(/^\/hook_(ok|no)_/, '');
    try {
      const res = await axios.post(`http://127.0.0.1:3010/api/hook/resolve/${id}`, { approved });
      const label = res.data?.ok
        ? (approved ? '✅ Permiso concedido' : '❌ Permiso denegado')
        : '⚠️ ID no encontrado';
      return bot.sendMessage(chatId, label);
    } catch (_) {
      return bot.sendMessage(chatId, '⚠️ No se pudo resolver el permiso (ya expiró o no existe).');
    }
  }

  // ── /exec ─────────────────────────────────────────────────────
  if (text.startsWith('/exec ')) {
    const cmd = text.replace('/exec ', '').trim();
    const inspection = inspectCommand(cmd);
    if (!inspection.ok) {
      logAction('telegram_exec_blocked', 'telegram-admin', 'blocked', inspection.reason, { chatId, cmd });
      return bot.sendMessage(chatId, `Bloqueado por seguridad: ${inspection.reason}`);
    }
    return handleClaudeReply(chatId, JSON.stringify({ action: 'exec', cmd, reason: 'Solicitud directa /exec' }));
  }

  // ── /plan ─────────────────────────────────────────────────────
  if (text.startsWith('/plan ')) {
    const planText = text.replace('/plan ', '').trim();
    const reply = await callClaude(`Crea un plan de ejecución breve para: ${planText}`);
    await sendEmail('Plan de Ejecución', reply);
    return bot.sendMessage(chatId, reply);
  }

  // ── Documentos ────────────────────────────────────────────────
  if (msg.document) {
    return handleDocumentInput(chatId, msg.document);
  }

  // ── Fotos ─────────────────────────────────────────────────────
  if (msg.photo) {
    return handleImageInput(chatId, msg.photo, msg.caption || '');
  }

  // ── Audio (archivo) ───────────────────────────────────────────
  if (msg.audio) {
    return handleAudioFileInput(chatId, msg.audio.file_id, 'audio');
  }

  // ── Video ─────────────────────────────────────────────────────
  if (msg.video) {
    return handleVideoInput(chatId, msg.video, msg.caption || '');
  }

  if (text && !text.startsWith('/')) {
    const flow = require('../shared/conversation-flow');
    const fsmOut = await flow.handleIncoming({
      channel: 'telegram',
      externalId: String(chatId),
      text,
      meta: { username: msg.from?.username, firstName: msg.from?.first_name }
    });
    if (fsmOut.actions) {
      const { dispatchActions } = require('../shared/action-dispatcher');
      try {
        dispatchActions(fsmOut.actions, { id: fsmOut.leadId, externalId: String(chatId) });
      } catch (error) {
        console.error('[telegram-actions]', error.message || error);
      }
    }
    if (fsmOut && fsmOut.state !== 'new') {
      return bot.sendMessage(chatId, fsmOut.reply);
    }
  }

  // ── URL inline ────────────────────────────────────────────────
  if (text) {
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const prompt = `El usuario compartió este link: ${urlMatch[0]}. Respondé brevemente qué podrías hacer con eso o pedí más contexto.`;
      const reply = await callClaudeWithMemory(prompt, 'telegram-admin', { maxTokens: 300, metadata: { chatId } });
      return handleClaudeReply(chatId, reply);
    }
  }

  // ── Texto general ─────────────────────────────────────────────
  if (text) {
    return handleAdminMessage(bot, msg);
  }
});

// ── Voz (nota de voz) ─────────────────────────────────────────
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  return handleAudioFileInput(chatId, msg.voice.file_id, 'voice');
});

bot.on('webhook_error', (error) => {
  console.error('[bot] Webhook error:', error?.message || error);
});

module.exports = { bot };
