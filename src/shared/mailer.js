const nodemailer = require('nodemailer');
const audit = require('./audit');

const sendWindows = new Map();

function recipientKey(to) {
  const raw = String(to || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  const at = raw.lastIndexOf('@');
  return at === -1 ? raw : raw.slice(at + 1);
}

function checkRecipientRateLimit(to, limit = 5, windowMs = 24 * 60 * 60 * 1000) {
  const key = recipientKey(to);
  const now = Date.now();
  const current = sendWindows.get(key);
  if (!current || now - current.windowStart >= windowMs) {
    sendWindows.set(key, { count: 1, windowStart: now });
    return null;
  }
  current.count += 1;
  sendWindows.set(key, current);
  if (current.count > limit) {
    return {
      ok: false,
      error: 'rate_limited',
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - current.windowStart)) / 1000)),
      scope: key,
    };
  }
  return null;
}

function redactAddress(to) {
  const value = String(to || '').trim();
  if (!value) return null;
  const at = value.indexOf('@');
  if (at <= 1) return '***';
  return `${value.slice(0, 2)}***${value.slice(at)}`;
}

function createMailTransport(env = process.env, mailer = nodemailer) {
  const password = env.GMAIL_APP_PASSWORD || env.GMAIL_PASS;
  const configured = Boolean(env.GMAIL_USER && password);
  audit.log({
    ts: new Date().toISOString(),
    event: 'mailer_transport_requested',
    configured,
    provider: 'gmail',
  });
  if (!configured) {
    audit.log({
      ts: new Date().toISOString(),
      event: 'mailer_transport_missing_config',
      provider: 'gmail',
    });
    return null;
  }

  const transport = mailer.createTransport({
    service: 'gmail',
    auth: { user: env.GMAIL_USER, pass: password },
  });
  audit.log({
    ts: new Date().toISOString(),
    event: 'mailer_transport_created',
    provider: 'gmail',
  });
  return transport;
}

async function sendMail(transport, options, { auditContext = {}, dryRun = false } = {}) {
  const redactedTo = redactAddress(options?.to);
  const subject = String(options?.subject || '').slice(0, 120);
  if (dryRun) {
    audit.log({
      ts: new Date().toISOString(),
      event: 'gmail_send_dry_run',
      to: redactedTo,
      subject,
      ...auditContext,
    });
    return { ok: true, dryRun: true, preview: { to: options?.to || '', subject, text: options?.text || '', html: options?.html || '' } };
  }
  const limited = checkRecipientRateLimit(options?.to);
  if (limited) {
    audit.log({
      ts: new Date().toISOString(),
      event: 'gmail_send_rate_limited',
      to: redactedTo,
      subject,
      ...auditContext,
    });
    const error = new Error('rate_limited');
    error.code = 'rate_limited';
    throw error;
  }
  audit.log({
    ts: new Date().toISOString(),
    event: 'gmail_send_intent',
    to: redactedTo,
    subject,
    ...auditContext,
  });
  const result = await transport.sendMail(options);
  audit.log({
    ts: new Date().toISOString(),
    event: 'gmail_send_ok',
    to: redactedTo,
    subject,
    messageId: result?.messageId || null,
    ...auditContext,
  });
  return result;
}

module.exports = {
  createMailTransport,
  sendMail,
  checkRecipientRateLimit,
};
