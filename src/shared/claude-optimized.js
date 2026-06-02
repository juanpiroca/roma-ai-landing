/**
 * Roma — Claude Integration (Optimized with Caching & Model Routing)
 *
 * Features:
 * - Prompt caching for system prompts (80% token reduction)
 * - Adaptive model routing (Haiku for simple tasks)
 * - Token usage tracking
 */

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./load-env');

loadEnv();

const logPath = path.join(process.cwd(), 'logs/roma.log');

// ── Token Usage Logging ──────────────────────────────────────────
function appendUsageLog(usage, model) {
  if (!usage) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      input_tokens: Number(usage.input_tokens || 0),
      output_tokens: Number(usage.output_tokens || 0),
      cache_creation_input_tokens: Number(usage.cache_creation_input_tokens || 0),
      cache_read_input_tokens: Number(usage.cache_read_input_tokens || 0),
      model,
    });
    fs.appendFileSync(logPath, `${entry}\n`);
  } catch (_) {}
}

// ── Model Selection (Adaptive Routing) ────────────────────────────
function selectModel(channel, prompt, options = {}) {
  // Override: explicit model specified
  if (options.model) return options.model;

  // Determine task complexity
  const isSimple = determineComplexity(channel, prompt, options) < 0.3;

  if (isSimple) {
    console.log(`[roma:model] Routing to Haiku (simple task, channel=${channel})`);
    return 'claude-3-5-haiku-20241022'; // 80% cheaper than Sonnet
  }

  return 'claude-sonnet-4-6'; // Default for complex reasoning
}

function determineComplexity(channel, prompt, options = {}) {
  // Voice channels: typically simple, ≤200 tokens expected
  if ((channel === 'siri' || channel === 'alexa') && (options.maxTokens || 500) <= 200) {
    return 0.2; // Simple
  }

  // Simple Telegram commands
  if (channel === 'telegram') {
    const simpleCommands = ['/auth', '/help', '/status', '/check', '/ping'];
    if (simpleCommands.some(cmd => prompt.includes(cmd))) {
      return 0.25; // Simple
    }
  }

  // Short prompts without context
  if (prompt.length < 100 && !options.extraContext) {
    return 0.3; // Borderline
  }

  // Everything else: complex (needs Sonnet)
  return 0.7;
}

// ── Basic Claude Call (No Memory) ────────────────────────────────
async function callClaude(prompt, options = {}) {
  const safePrompt = String(prompt || '').trim();
  if (!safePrompt) {
    return options.emptyMessage || 'No entendí el mensaje, mandame algo de nuevo.';
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no configurada');
  }

  const { Anthropic } = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const model = selectModel('none', safePrompt, options);

  const msg = await client.messages.create({
    model,
    max_tokens: options.maxTokens || 300,
    system: [
      {
        type: 'text',
        text: options.system || 'Responde en español, directo y breve.',
        cache_control: { type: 'ephemeral' }, // ← CACHE ENABLED
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: safePrompt,
          },
        ],
      },
    ],
  });

  appendUsageLog(msg.usage, model);
  return msg.content?.[0]?.text || '';
}

// ── Claude with Memory (Multi-Turn) ──────────────────────────────
async function callClaudeWithMemory(prompt, channel, options = {}) {
  const safePrompt = String(prompt || '').trim();
  if (!safePrompt) {
    return options.emptyMessage || 'No entendí el mensaje, mandame algo de nuevo.';
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

  const memory = require('./memory');
  const { Anthropic } = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  // 1. Adaptive model selection
  const model = selectModel(channel, safePrompt, options);

  // 2. Build system prompt (cached)
  const systemPrompt = options.system ||
    memory.buildSystemPrompt(channel, options.extraContext);

  // 3. Get conversation history
  const messages = memory.getClaudeMessages(
    channel,
    safePrompt,
    options.historyLimit || 20
  );

  // 4. Call API with caching enabled
  const msg = await client.messages.create({
    model,
    max_tokens: options.maxTokens || 500,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }, // ← System prompt cached
      },
    ],
    messages: messages.map((m, idx) => ({
      role: m.role,
      content: [
        {
          type: 'text',
          text: m.content,
          // Cache full context for last message in long conversations
          cache_control:
            idx === messages.length - 1 && messages.length > 5
              ? { type: 'ephemeral' }
              : undefined,
        },
      ],
    })),
  });

  const reply = msg.content?.[0]?.text || '';

  // 5. Save to memory (single append, no duplication)
  memory.appendMessage({ channel, role: 'user', content: safePrompt });
  memory.appendMessage({ channel, role: 'assistant', content: reply });

  // 6. Log usage with cache metrics
  const usageLog = {
    ...msg.usage,
    model,
    channel,
    cached: (msg.usage.cache_read_input_tokens || 0) > 0,
  };
  appendUsageLog(usageLog, model);

  return reply;
}

// ── Batch Caching Helper ─────────────────────────────────────────
// For multi-turn conversations with checkpoint caching
async function callClaudeWithCheckpoint(prompt, channel, checkpointKey, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

  const memory = require('./memory');
  const { Anthropic } = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const model = selectModel(channel, prompt, options);
  const systemPrompt = options.system ||
    memory.buildSystemPrompt(channel, options.extraContext);

  // Get full history and split at checkpoint
  const fullHistory = memory.getHistory(channel, 100);
  const checkpointIdx = fullHistory.findIndex(
    m => m.ts === checkpointKey
  );

  const beforeCheckpoint = fullHistory.slice(0, checkpointIdx + 1);
  const afterCheckpoint = fullHistory.slice(checkpointIdx + 1);

  // Build messages with checkpoint caching
  const messages = [];

  // Add pre-checkpoint as cached context
  if (beforeCheckpoint.length > 0) {
    messages.push(...beforeCheckpoint.map((m, idx) => ({
      role: m.role,
      content: [
        {
          type: 'text',
          text: m.content,
          cache_control: idx === beforeCheckpoint.length - 1
            ? { type: 'ephemeral' }
            : undefined,
        },
      ],
    })));
  }

  // Add post-checkpoint (non-cached, current context)
  messages.push(...afterCheckpoint.map(m => ({
    role: m.role,
    content: [{ type: 'text', text: m.content }],
  })));

  // Add new prompt
  messages.push({
    role: 'user',
    content: [{ type: 'text', text: prompt }],
  });

  const msg = await client.messages.create({
    model,
    max_tokens: options.maxTokens || 500,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  const reply = msg.content?.[0]?.text || '';
  memory.appendMessage({ channel, role: 'user', content: prompt });
  memory.appendMessage({ channel, role: 'assistant', content: reply });

  appendUsageLog(msg.usage, model);
  return reply;
}

module.exports = {
  callClaude,
  callClaudeWithMemory,
  callClaudeWithCheckpoint,
  appendUsageLog,
  selectModel,
  determineComplexity,
  logPath,
};
