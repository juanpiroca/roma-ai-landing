'use strict';

const https = require('https');
const { syncLead } = require('./wp-sync');

const THROTTLE_MS = 5 * 60 * 1000;
const _lastScored = new Map();

function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'Analiza estas conversaciones de ventas y devuelve SOLO un JSON con: {"score": 0-100, "stage": "new|contacted|qualified|opportunity|won|lost", "reason": "string breve"}. Sin texto adicional.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const req = https.request(
      {
        hostname: 'api.deepseek.com',
        path: '/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const content = data?.choices?.[0]?.message?.content || '{}';
            const cleaned = content.replace(/```json?|```/g, '').trim();
            resolve(JSON.parse(cleaned));
          } catch (e) {
            reject(new Error('DeepSeek parse error: ' + e.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('DeepSeek timeout')); });
    req.write(body);
    req.end();
  });
}

async function scoreLeadWithAI(leadId, conversations, leadMeta = {}) {
  const key = String(leadId);
  const now = Date.now();

  if (_lastScored.has(key) && now - _lastScored.get(key) < THROTTLE_MS) {
    return null;
  }

  const prompt = JSON.stringify({
    lead_id: leadId,
    name: leadMeta.name || 'Desconocido',
    channel: leadMeta.channel || 'web',
    recent_messages: (conversations || []).slice(-10).map((m) => ({
      role: m.role || m.direction,
      content: String(m.content || m.message || '').slice(0, 300),
      at: m.created_at || m.ts,
    })),
  });

  let result;
  try {
    result = await callDeepSeek(prompt);
  } catch (err) {
    console.warn('[lead-scorer] IA error for lead', leadId, err.message);
    return { score: 50, stage: 'new', reason: 'error_ia' };
  }

  const score = Math.min(100, Math.max(0, parseInt(result.score) || 50));
  const stage = ['new', 'contacted', 'qualified', 'opportunity', 'won', 'lost'].includes(result.stage)
    ? result.stage
    : 'contacted';

  _lastScored.set(key, now);

  try {
    await syncLead({
      ...leadMeta,
      score,
      stage,
      lastMessage: result.reason || '',
    });
  } catch (e) {
    console.warn('[lead-scorer] wp-sync error for lead', leadId, e.message);
  }

  return { score, stage, reason: result.reason || '' };
}

module.exports = { scoreLeadWithAI };
