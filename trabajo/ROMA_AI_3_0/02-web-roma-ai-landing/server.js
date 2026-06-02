const express = require('express');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { callModel } = require('./ai-client');
const { syncLead } = require('/home/juanpi/Roma/src/shared/wp-sync');

const DEFAULT_RUNTIME_ROOT = '/home/juanpi/Roma/trabajo/ROMA_AI_3_0/runtime';
const WEBCHAT_COMPONENT_DIR = '/home/juanpi/JuanPi-Agent/Roma-AI/webchat';
const PROMPT_PATH = '/home/juanpi/Roma-AI-perfil/20-system-prompt-final.md';
const ROMA_KB_BUNDLE = process.env.ROMA_KB_BUNDLE || '/home/juanpi/roma/integraciones/roma_kb_bundle.json';
const webChatSessions = new Map();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getRuntimeRoot() {
  return process.env.ROMA_AI_3_RUNTIME_DIR || DEFAULT_RUNTIME_ROOT;
}

function getLeadsDir() {
  return path.join(getRuntimeRoot(), 'leads');
}

function sanitizeSessionId(sessionId) {
  const value = String(sessionId ?? '').trim();
  if (!value) {
    throw new Error('sessionId is required');
  }

  if (value.length > 120) {
    throw new Error('sessionId is too long');
  }

  return value;
}

function getSafeLeadPath(sessionId) {
  const safeName = crypto.createHash('sha256').update(sessionId).digest('hex');
  return path.join(getLeadsDir(), `web-${safeName}.json`);
}

function mapToEnum(raw) {
  const text = String(raw ?? '').toLowerCase();
  if (/venta/.test(text)) return 'ventas';
  if (/atencion|atención|cliente/.test(text)) return 'atencion';
  if (/contenido|redes|social/.test(text)) return 'contenido';
  if (/anuncio|ads|publicidad/.test(text)) return 'anuncios';
  if (/automat/.test(text)) return 'automatizacion';
  if (/\bweb\b|sitio|pagina|página|landing/.test(text)) return 'web';
  return 'general';
}

function mentionsPrice(message) {
  return /precio|costo|cu[aá]nto|cuanto|how much|pricing|cost/i.test(String(message || ''));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isValidAnswer(value) {
  return normalizeText(value).length >= 3;
}

function isSameAnswer(a, b) {
  return normalizeText(a) && normalizeText(a) === normalizeText(b);
}

function getSessionMemory(sessionId) {
  if (!webChatSessions.has(sessionId)) {
    webChatSessions.set(sessionId, {
      messages: [],
      webAnswer1: '',
      webAnswer2: '',
      messageCount: 0,
    });
  }

  return webChatSessions.get(sessionId);
}

function buildWaLink() {
  const whatsappNumber = process.env.WHATSAPP_US_NUMBER || '12019696812';
  return `https://wa.me/${whatsappNumber}`;
}

function buildReply({ sessionCount, webAnswer1, webAnswer2, message, showCTA, waLink }) {
  const negocio = String(webAnswer1 || '').trim();

  if (showCTA) {
    if (mentionsPrice(message)) {
      return `Te paso precio exacto por WhatsApp según tu caso (${negocio || 'tu negocio'}): ${waLink}`;
    }

    return `Perfecto, ya tengo contexto de ${negocio || 'tu negocio'}. Seguimos por WhatsApp y te dejo una propuesta concreta: ${waLink}`;
  }

  if (!isValidAnswer(webAnswer1)) {
    return '¡Genial! Contame primero qué tipo de negocio tenés (ej: barbería, clínica, inmobiliaria).';
  }

  if (!isValidAnswer(webAnswer2) && sessionCount <= 3) {
    return `Excelente, ${negocio}. ¿Qué querés mejorar primero: más citas/ventas, respuesta más rápida o seguimiento automático?`;
  }

  return `Perfecto ${negocio ? `para ${negocio}` : ''}. Si querés, te comparto una propuesta por WhatsApp: ${waLink}`;
}

function forwardMarketingChat(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(
      'http://localhost:3099/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          source: 'roma-ai',
        },
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(raw || '{}'));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function getKbBusinessContext() {
  try {
    const raw = require('node:fs').readFileSync(ROMA_KB_BUNDLE, 'utf8');
    const bundle = JSON.parse(raw);
    const faqCount = Array.isArray(bundle?.faq?.faq) ? bundle.faq.faq.length : 0;
    const intentsCount = Array.isArray(bundle?.intents?.intents) ? bundle.intents.intents.length : 0;
    return `\n\n[ROMA_KB]\nversion=${bundle.version || '1.0'}\nfaq_count=${faqCount}\nintents_count=${intentsCount}\nregla_precio=No cerrar por debajo de margen 35%; si faltan datos, pedirlos antes de cotización final.\n[/ROMA_KB]`;
  } catch {
    return '\n\n[ROMA_KB]\nversion=unavailable\n[/ROMA_KB]';
  }
}

async function loadSystemPrompt(waLink) {
  try {
    const content = await fs.readFile(PROMPT_PATH, 'utf8');
    return content.replace(/\{\{WHATSAPP_LINK\}\}/g, waLink) + getKbBusinessContext();
  } catch {
    return [
      'Sos ROMA AI, una asesora mujer: profesional, cercana y resolutiva.',
      'Respondé siempre en español neutro con tono humano, claro y sin sonar robótica.',
      'Tus mensajes deben ser breves (2 a 4 líneas), concretos y útiles para ventas/atención.',
      'Usá emojis solo cuando aporten claridad o calidez; evitá emoticones genéricos.',
      'No uses relleno ni frases vacías.',
      `Si corresponde derivar a WhatsApp, compartí exactamente este link: ${waLink}`,
      'Si ya hiciste preguntas de contexto, no reinicies la conversación.',
      'Nunca cierres precio final sin datos mínimos de alcance y margen >= 35%.',
    ].join(' ') + getKbBusinessContext();
  }
}

async function saveWebLead(lead) {
  const sessionId = sanitizeSessionId(lead.lead_id);
  await fs.mkdir(getLeadsDir(), { recursive: true });
  const leadPath = getSafeLeadPath(sessionId);
  await fs.writeFile(leadPath, `${JSON.stringify(lead, null, 2)}\n`, 'utf8');

  try {
    await syncLead({
      name: lead.name || lead.business_type || lead.lead_id,
      phone: lead.phone || lead.lead_id,
      channel: 'webchat',
      score: typeof lead.score === 'number' ? lead.score : 50,
      stage: lead.status || 'new',
      lastMessage: lead.interest_area || lead.business_type || '',
      clientId: process.env.WP_DEFAULT_CLIENT_ID || process.env.WP_CLIENT_ID || '1',
      source: lead.source || 'web_chat',
    });
  } catch (error) {
    console.error('[wp-sync] web lead sync failed:', error.message);
  }
}

function syncSessionAnswers(session, incomingAnswer1, incomingAnswer2) {
  if (isValidAnswer(incomingAnswer1)) {
    session.webAnswer1 = incomingAnswer1;
  }

  if (isValidAnswer(incomingAnswer2) && !isSameAnswer(incomingAnswer1 || session.webAnswer1, incomingAnswer2)) {
    session.webAnswer2 = incomingAnswer2;
  }
}

function captureImplicitAnswer(session, message) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return;
  }

  if (!session.webAnswer1 && session.messageCount >= 1) {
    session.webAnswer1 = trimmed;
    return;
  }

  if (!session.webAnswer2 && session.webAnswer1 && session.messageCount >= 2 && !mentionsPrice(trimmed)) {
    session.webAnswer2 = trimmed;
  }
}

function createApp(options = {}) {
  const app = express();
  const saveLeadImpl = options.saveLeadImpl || saveWebLead;
  const callModelImpl = options.callModelImpl || callModel;
  const marketingChatImpl = options.marketingChatImpl || forwardMarketingChat;
  const indexPath = path.join(__dirname, 'index.html');
  const adminPanelDir =
    process.env.ROMA_ADMIN_PANEL_DIR || '/home/juanpi/JuanPi-Agent/Roma-AI/admin-panel';
  const adminIndexPath = path.join(adminPanelDir, 'index.html');
  const dashboardProPath = '/home/juanpi/LAB/Roma 4.0/roma-ai-sales/dashboard-roma-pro.html';

  app.use(express.json());
  app.use('/assets', express.static(path.join(__dirname, 'assets')));
  app.use('/logo-concepts', express.static(path.join(__dirname, 'logo-concepts')));
  app.use('/roma-webchat', express.static(WEBCHAT_COMPONENT_DIR));
  app.use('/admin', express.static(adminPanelDir));
  app.use('/admin/', express.static(adminPanelDir));

  app.get(['/admin', '/admin/', '/admin/login', '/admin/dashboard'], (_req, res) => {
    res.sendFile(adminIndexPath);
  });

  app.get(/^\/admin\/.*/, (_req, res) => {
    res.sendFile(adminIndexPath);
  });

  // Serve dashboard-roma-pro.html as /admin-panel
  app.get('/admin-panel', (_req, res) => {
    res.sendFile(dashboardProPath);
  });

  app.get('/', (_req, res) => {
    res.sendFile(indexPath);
  });

  app.get(['/voice', '/voice.html'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'voice.html'));
  });

  app.get(['/webchat', '/webchat.html'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'webchat-improved.html'));
  });

  app.get(['/login', '/login.html'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
  });

  app.get(['/terms', '/terms.html'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'terms.html'));
  });

  app.get(['/privacy', '/privacy.html'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'privacy.html'));
  });

  app.post('/marketing/chat', async (req, res) => {
    try {
      const payload = {
        ...req.body,
        source: 'roma-ai',
      };
      res.status(200).json(await marketingChatImpl(payload));
    } catch (_error) {
      res.status(500).json({ error: 'Error interno' });
    }
  });

  app.post('/api/webchat', async (req, res) => {
    try {
      const sessionId = sanitizeSessionId(req.body?.sessionId);
      const session = getSessionMemory(sessionId);
      const message = String(req.body?.message ?? '').trim();
      const incomingAnswer1 = String(req.body?.webAnswer1 ?? '').trim();
      const incomingAnswer2 = String(req.body?.webAnswer2 ?? '').trim();

      if (!message) {
        res.status(400).json({ error: 'Mensaje requerido' });
        return;
      }

      session.messageCount += 1;
      session.messages.push({ role: 'user', content: message });
      syncSessionAnswers(session, incomingAnswer1, incomingAnswer2);
      captureImplicitAnswer(session, message);

      if (isSameAnswer(session.webAnswer1, session.webAnswer2)) {
        session.webAnswer2 = '';
      }

      const waLink = buildWaLink();
      const webAnswer1 = session.webAnswer1;
      const webAnswer2 = session.webAnswer2;
      const sessionCount = session.messageCount;
      const readyForCTA = isValidAnswer(webAnswer1) && isValidAnswer(webAnswer2) && !isSameAnswer(webAnswer1, webAnswer2);
      const showCTA = readyForCTA || mentionsPrice(message) || sessionCount >= 5;
      const deterministicReply = buildReply({
        sessionCount,
        webAnswer1,
        webAnswer2,
        message,
        showCTA,
        waLink,
      });
      const systemPrompt = await loadSystemPrompt(waLink);
      const modelResult = await callModelImpl({
        systemPrompt,
        userMessage: message,
        context: {
          messages: session.messages,
          sessionCount,
          messageCount: sessionCount,
          webAnswer1,
          webAnswer2,
          showCTA,
          waLink,
          fallbackReply: deterministicReply,
        },
        options: options.modelOptions || {},
      }).catch(() => ({ reply: deterministicReply }));
      const reply = String(modelResult?.reply || deterministicReply)
        .replace(/\{\{WHATSAPP_LINK\}\}/g, waLink);
      session.messages.push({ role: 'assistant', content: reply });

      if (webAnswer1 && webAnswer2) {
        const now = new Date().toISOString();
        await saveLeadImpl({
          lead_id: sessionId,
          source: 'web_chat',
          channel: 'web_chat',
          business_type: webAnswer1,
          interest_area: mapToEnum(webAnswer2),
          status: 'web_started',
          assigned_to: 'juanpi',
          created_at: now,
          updated_at: now,
        });
      }

      res.status(200).json({
        reply,
        showCTA,
        waLink,
      });
    } catch (_error) {
      res.status(500).json({ error: 'Error interno' });
    }
  });

  return app;
}

module.exports = {
  createApp,
  forwardMarketingChat,
  mapToEnum,
};

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port);
}
