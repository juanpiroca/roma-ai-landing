const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bcurl\b.*\|\s*(sh|bash)/i,
  /\bwget\b.*\|\s*(sh|bash)/i,
  />\s*\/etc\//i,
  /\bchmod\s+777\b/i,
  /\bchown\b/i,
  /\b(eval|exec)\b/i,
];

const REQUIRED_ENV = {
  bot: ['TELEGRAM_TOKEN_OR_BOT_TOKEN', 'ALLOWED_CHAT_ID', 'ANTHROPIC_API_KEY'],
  voice: ['ROMA_SECRET', 'TELEGRAM_TOKEN_OR_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ANTHROPIC_API_KEY'],
};

const ENV_FORMAT_RULES = {
  ANTHROPIC_API_KEY: (value) => /^sk-ant-/.test(value) && !/\s/.test(value),
  OPENAI_API_KEY: (value) => /^sk-/.test(value) && !/\s/.test(value),
  TELEGRAM_TOKEN: (value) => /^\d+:[A-Za-z0-9_-]{20,}$/.test(value),
  ALLOWED_CHAT_ID: (value) => /^-?\d+(,-?\d+)*$/.test(value),
  TELEGRAM_CHAT_ID: (value) => /^-?\d+(,-?\d+)*$/.test(value),
  ROMA_SECRET: (value) => value.length >= 6 && !/^\s|\s$/.test(value),
};

function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

function validateRequiredEnv(scope) {
  const readEnvValue = (key) => {
    if (key === 'TELEGRAM_TOKEN_OR_BOT_TOKEN') {
      return process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
    }
    return process.env[key];
  };
  const missing = (REQUIRED_ENV[scope] || []).filter((key) => !readEnvValue(key));
  const invalid = (REQUIRED_ENV[scope] || []).filter((key) => {
    const value = readEnvValue(key);
    const rule = ENV_FORMAT_RULES[key === 'TELEGRAM_TOKEN_OR_BOT_TOKEN' ? 'TELEGRAM_TOKEN' : key];
    return Boolean(value) && rule && !rule(String(value).trim());
  });
  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

function getAudioEnvStatus() {
  const openaiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    return { ok: false, reason: 'OPENAI_API_KEY no configurada' };
  }

  const rule = ENV_FORMAT_RULES.OPENAI_API_KEY;
  if (rule && !rule(openaiKey)) {
    return { ok: false, reason: 'OPENAI_API_KEY inválida' };
  }

  return { ok: true, reason: null };
}

function inspectCommand(command) {
  if (!command || typeof command !== 'string') {
    return { ok: false, reason: 'Comando vacío o inválido' };
  }

  const normalized = command.trim();
  if (normalized.length > 400) {
    return { ok: false, reason: 'Comando demasiado largo' };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(normalized)) {
      return { ok: false, reason: 'Comando bloqueado por política de seguridad' };
    }
  }

  return { ok: true };
}

module.exports = {
  DANGEROUS_PATTERNS,
  ENV_FORMAT_RULES,
  getAudioEnvStatus,
  inspectCommand,
  maskSecret,
  validateRequiredEnv,
};
