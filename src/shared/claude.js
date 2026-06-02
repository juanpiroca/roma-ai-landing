const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./load-env');

loadEnv();

const logPath = path.join(process.cwd(), 'logs/roma.log');

function appendUsageLog(usage, model) {
  if (!usage) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      input_tokens: Number(usage.input_tokens || usage.prompt_tokens || 0),
      output_tokens: Number(usage.output_tokens || usage.completion_tokens || 0),
      model,
    });
    fs.appendFileSync(logPath, `${entry}\n`);
  } catch (_) {}
}

// ── Call OpenAI (primary) ───────────────────────────────
async function callOpenAI(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const channel = options.channel || 'telegram';
  const memory = require('./memory');
  
  // Build system prompt with greeting rules
  const history = memory.getHistory(channel, 2);
  const hasHistory = history.length > 0;
  const greetingRule = hasHistory
    ? 'NO uses "Hola" ni saludes - ya saludaste antes. Continua la conversacion naturalmente.'
    : 'Podes empezar con un saludo suave, pero solo una vez.';
  
  const basePrompt = memory.buildSystemPrompt(channel, options.extraContext);
  const systemPrompt = basePrompt + '\n\nREGLAS DE SALUDO:\n' + greetingRule + '\n- Si sabes el nombre del usuario, USA su nombre.\n- No saludes mas de una vez por conversacion.\n- Despues del primer mensaje, continua sin "Hola".';
  const messages = memory.getClaudeMessages(channel, prompt, options.historyLimit || 20);

  // Add system message at the beginning
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const model = options.model || 'gpt-4o-mini';
  const maxTokens = options.maxTokens || 500;

  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: fullMessages,
  });

  const reply = completion.choices?.[0]?.message?.content || '';
  appendUsageLog(completion.usage, model);
  return reply;
}

// ── Call DeepSeek (fallback) ────────────────────────────
async function callDeepSeek(prompt, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada');

  const channel = options.channel || 'telegram';
  const memory = require('./memory');
  
  // Build system prompt with greeting rules
  const history = memory.getHistory(channel, 2);
  const hasHistory = history.length > 0;
  const greetingRule = hasHistory
    ? 'NO uses "Hola" ni saludes - ya saludaste antes. Continua la conversacion naturalmente.'
    : 'Podes empezar con un saludo suave, pero solo una vez.';
  
  const basePrompt = memory.buildSystemPrompt(channel, options.extraContext);
  const systemPrompt = basePrompt + '\n\nREGLAS DE SALUDO:\n' + greetingRule + '\n- Si sabes el nombre del usuario, USA su nombre.\n- No saludes mas de una vez por conversacion.\n- Despues del primer mensaje, continua sin "Hola".';
  const messages = memory.getClaudeMessages(channel, prompt, options.historyLimit || 20);

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const model = 'deepseek-v4-flash';
  const maxTokens = options.maxTokens || 500;

  const OpenAI = require('openai');
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com/v1',
  });

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: fullMessages,
  });

  const reply = completion.choices?.[0]?.message?.content || '';
  appendUsageLog(completion.usage, model);
  return reply;
}

// ── Primary: OpenAI with automatic DeepSeek fallback ────
async function callClaudeWithMemory(prompt, channel, options = {}) {
  const safePrompt = String(prompt || '').trim();
  if (!safePrompt) {
    return options.emptyMessage || 'No entendi el mensaje, mandame algo de nuevo.';
  }

  const memory = require('./memory');
  let reply, modelUsed;

  // Try OpenAI first (primary)
  try {
    reply = await callOpenAI(prompt, { ...options, channel });
    modelUsed = 'openai-gpt-4o-mini';
  } catch (openaiErr) {
    console.error(`[Roma] OpenAI falló: ${openaiErr.message}. Probando DeepSeek...`);

    // Fallback to DeepSeek
    try {
      reply = await callDeepSeek(prompt, { ...options, channel });
      modelUsed = 'deepseek-v4-flash';
    } catch (deepseekErr) {
      console.error(`[Roma] DeepSeek también falló: ${deepseekErr.message}`);
      return options.emptyMessage || 'Error al procesar tu mensaje. Intenta de nuevo.';
    }
  }

  // Guardar en memoria
  memory.appendMessage({ channel, role: 'user', content: safePrompt, metadata: options.metadata || {} });
  memory.appendMessage({ channel, role: 'assistant', content: reply, metadata: { ...options.metadata, model: modelUsed } });

  return reply;
}

// ── Simple one-shot (no memory) ─────────────────────────
async function callClaude(prompt, options = {}) {
  const safePrompt = String(prompt || '').trim();
  if (!safePrompt) {
    return options.emptyMessage || 'No entendi el mensaje, mandame algo de nuevo.';
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    max_tokens: options.maxTokens || 300,
    messages: [
      { role: 'system', content: options.system || 'Responde en español, directo y breve.' },
      { role: 'user', content: safePrompt },
    ],
  });

  const reply = completion.choices?.[0]?.message?.content || '';
  appendUsageLog(completion.usage, options.model || 'gpt-4o-mini');
  return reply;
}

module.exports = {
  callClaude,
  callClaudeWithMemory,
  appendUsageLog,
  logPath,
};
