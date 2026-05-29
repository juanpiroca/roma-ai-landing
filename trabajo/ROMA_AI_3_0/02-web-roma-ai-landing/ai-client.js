const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

function sanitizeReply(text, fallbackReply, waLink) {
  const value = String(text || '').trim();
  if (!value) {
    return String(fallbackReply || 'Sigamos por WhatsApp para darte algo mas concreto.').trim();
  }

  return value.replace(/\{\{WHATSAPP_LINK\}\}/g, waLink || '').trim();
}

async function callDeepSeek({ systemPrompt, userMessage, context, options }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('Missing required environment variable: DEEPSEEK_API_KEY');
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch implementation is required');
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
  const model = process.env.ROMA_AI_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: [
            systemPrompt,
            context?.showCTA ? '\n[CONTEXTO: ya hiciste las 2 preguntas y diste el CTA de WhatsApp. Si el usuario sigue escribiendo, recordalo amablemente hacia WhatsApp sin reiniciar el saludo ni presentarte de nuevo.]' : '',
          ].join(''),
        },
        ...(Array.isArray(context?.messages) && context.messages.length > 0
          ? context.messages
          : [{ role: 'user', content: userMessage }]),
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return sanitizeReply(payload?.choices?.[0]?.message?.content, context?.fallbackReply, context?.waLink);
}

async function callClaude({ systemPrompt, userMessage, context, options }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing required environment variable: ANTHROPIC_API_KEY');
  }

  const fetchImpl = options.anthropicFetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch implementation is required');
  }

  const response = await fetchImpl(DEFAULT_ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 250,
      system: systemPrompt,
      messages: Array.isArray(context?.messages) && context.messages.length > 0
        ? context.messages
        : [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return sanitizeReply(payload?.content?.[0]?.text, context?.fallbackReply, context?.waLink);
}

async function callOpenAI({ systemPrompt, userMessage, context, options }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch implementation is required');
  }

  const baseUrl = process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL;
  const model = process.env.ROMA_AI_MODEL || DEFAULT_OPENAI_MODEL;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...(Array.isArray(context?.messages) && context.messages.length > 0
          ? context.messages
          : [{ role: 'user', content: userMessage }]),
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return sanitizeReply(payload?.choices?.[0]?.message?.content, context?.fallbackReply, context?.waLink);
}

async function callModel({ systemPrompt, userMessage, context = {}, options = {} }) {
  const provider = process.env.ROMA_AI_PROVIDER || 'openai';
  const fallbackProvider = process.env.ROMA_AI_FALLBACK_PROVIDER || '';
  const fallbackReply = sanitizeReply(
    context.fallbackReply,
    'Perfecto. Sigamos por WhatsApp para darte algo mas concreto.',
    context.waLink,
  );

  // Provider: deepseek
  if (provider === 'deepseek') {
    try {
      const reply = await callDeepSeek({ systemPrompt, userMessage, context, options });
      return { reply, source: 'deepseek' };
    } catch (_error) {
      if (fallbackProvider === 'claude' && process.env.ANTHROPIC_API_KEY) {
        try {
          const reply = await callClaude({ systemPrompt, userMessage, context, options });
          return { reply, source: 'claude' };
        } catch (_fallbackError) {
          return { reply: fallbackReply, source: 'deterministic_fallback' };
        }
      }

      return { reply: fallbackReply, source: 'deterministic_fallback' };
    }
  }

  // Provider: openai (default)
  if (provider === 'openai' || !provider || provider === '') {
    try {
      const reply = await callOpenAI({ systemPrompt, userMessage, context, options });
      return { reply, source: 'openai' };
    } catch (_error) {
      if (fallbackProvider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
        try {
          const reply = await callDeepSeek({ systemPrompt, userMessage, context, options });
          return { reply, source: 'deepseek' };
        } catch (_fallbackError) {
          return { reply: fallbackReply, source: 'deterministic_fallback' };
        }
      }
      if (fallbackProvider === 'claude' && process.env.ANTHROPIC_API_KEY) {
        try {
          const reply = await callClaude({ systemPrompt, userMessage, context, options });
          return { reply, source: 'claude' };
        } catch (_fallbackError) {
          return { reply: fallbackReply, source: 'deterministic_fallback' };
        }
      }

      return { reply: fallbackReply, source: 'deterministic_fallback' };
    }
  }

  // Provider: claude
  if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
    try {
      const reply = await callClaude({ systemPrompt, userMessage, context, options });
      return { reply, source: 'claude' };
    } catch (_error) {
      return { reply: fallbackReply, source: 'deterministic_fallback' };
    }
  }

  return { reply: fallbackReply, source: 'deterministic_fallback' };
}

module.exports = {
  callModel,
  callOpenAI,
};
