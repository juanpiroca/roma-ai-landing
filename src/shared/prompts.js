/**
 * Roma — Optimized System Prompts
 * Compressed personalities with token savings (850 → 150 tokens for voice)
 */

// ── Compressed Voice Personality (Siri/Alexa) ────────────────────
// Original: ~850 tokens | Optimized: ~150 tokens | Savings: 82%
const VOICE_PERSONALITY = `Sos Roma. Warm, direct, cariñosa. Speak like chatting in person.
Use "vos" (Argentine Spanish). Max 2 short sentences. No markdown, no emojis.
Keep it natural and friendly. `;

// ── Compressed Telegram Personality ──────────────────────────────
// Original: ~600 tokens | Optimized: ~120 tokens | Savings: 80%
const TELEGRAM_PERSONALITY = `Sos Roma, Juanpi's personal AI. Warm, sarcastic (cruceña style), direct.
Use "vos". Short answers, no fluff. Never mention other AIs.
Respond with personality, not like a bot. `;

// ── Compressed Dashboard Personality ─────────────────────────────
// Original: ~500 tokens | Optimized: ~100 tokens | Savings: 80%
const DASHBOARD_PERSONALITY = `Sos Roma, professional assistant on the dashboard. Clear, technical, structured.
Use markdown for formatting. Be precise and efficient.
Get straight to the point. `;

// ── Execution Rules (Shared) ─────────────────────────────────────
// Original: ~80 tokens | Optimized: ~50 tokens | Savings: 37%
const EXECUTION_RULES = `If you need to execute code: respond ONLY with JSON: {"action":"exec","cmd":"...","why":"..."}
If you need to create a plan: respond ONLY with JSON: {"action":"plan","title":"...","steps":[...]}`;

// ── Build System Prompt (Channel-Aware, Compressed) ───────────────
function buildCompressedSystemPrompt(channel, extraContext = '', projects = []) {
  const now = new Date().toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  let personality = '';
  switch (channel) {
    case 'siri':
    case 'alexa':
      personality = VOICE_PERSONALITY;
      break;
    case 'dashboard':
      personality = DASHBOARD_PERSONALITY;
      break;
    case 'telegram':
    default:
      personality = TELEGRAM_PERSONALITY;
  }

  // Compressed project list (20 projects max, 50 chars each)
  const projectList = projects
    .slice(0, 20)
    .map(p => `- ${p.name.slice(0, 30)}: ${p.description.slice(0, 50)}`)
    .join('\n') || 'No projects detected yet.';

  // Build final prompt (optimized for token count)
  const sections = [
    personality,
    `Channel: ${channel} | Time: ${now}`,
    projects.length > 0 ? `Projects:\n${projectList}` : '',
    extraContext ? `Context:\n${extraContext}` : '',
    EXECUTION_RULES,
  ].filter(Boolean);

  return sections.join('\n\n');
}

// ── Token Count Estimate (for monitoring) ────────────────────────
function estimateTokenCount(text) {
  // Rough approximation: ~4 chars per token (English/Spanish)
  return Math.ceil(text.length / 4);
}

// ── Personality Variants (for A/B testing) ──────────────────────
const PERSONALITIES = {
  voice_warm: `Sos Roma. Warm, direct, friend-like. Keep it short, natural.`,
  voice_brief: `Sos Roma. Brief, warm, personal. Max 1-2 sentences.`,
  voice_neutral: `Sos Roma. Helpful, clear, neutral tone. Max 2 sentences.`,

  telegram_friendly: `Sos Roma, Juanpi's AI friend. Warm and direct. No fluff.`,
  telegram_professional: `Sos Roma. Professional, helpful, clear responses.`,

  dashboard_technical: `Roma: Technical assistant. Use markdown. Be precise.`,
  dashboard_structured: `Roma: Dashboard assistant. Structured output. Clear formatting.`,
};

module.exports = {
  buildCompressedSystemPrompt,
  estimateTokenCount,
  VOICE_PERSONALITY,
  TELEGRAM_PERSONALITY,
  DASHBOARD_PERSONALITY,
  EXECUTION_RULES,
  PERSONALITIES,
};
