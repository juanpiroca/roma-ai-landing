'use strict';

const windows = new Map();

function clientKey(req, name) {
  const ip = req.socket?.remoteAddress || req.ip || 'unknown';
  const user = req.cookies?.roma_session || 'anon';
  return `${name}:${ip}:${user}`;
}

function check(req, name, limit, windowMs) {
  const key = clientKey(req, name);
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.windowStart >= windowMs) {
    windows.set(key, { count: 1, windowStart: now });
    return null;
  }
  current.count += 1;
  windows.set(key, current);
  if (current.count > limit) {
    return {
      ok: false,
      error: 'rate_limited',
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - current.windowStart)) / 1000)),
    };
  }
  return null;
}

module.exports = { check };
