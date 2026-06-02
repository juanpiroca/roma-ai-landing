'use strict';

const fs = require('fs');
const path = require('path');

const DATA_LOG = path.resolve(__dirname, '../../data/audit.log');
const LOG_LOG = path.resolve(__dirname, '../../logs/audit.log');
const MAX_SIZE = 5 * 1024 * 1024;

function rotate(file) {
  try {
    if (!fs.existsSync(file) || fs.statSync(file).size < MAX_SIZE) return;
    const one = `${file}.1`;
    const two = `${file}.2`;
    if (fs.existsSync(two)) fs.rmSync(two, { force: true });
    if (fs.existsSync(one)) fs.renameSync(one, two);
    fs.renameSync(file, one);
  } catch (_) {}
}

function append(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  rotate(file);
  fs.appendFileSync(file, line + '\n');
}

function log(entry) {
  const line = JSON.stringify(entry);
  append(DATA_LOG, line);
  append(LOG_LOG, line);
}

function middleware() {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      log({
        ts: new Date().toISOString(),
        ip: req.socket?.remoteAddress || req.ip || 'unknown',
        user: req.cookies?.roma_session ? 'session' : 'anon',
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durMs: Date.now() - start,
        bodySize: Number(req.headers['content-length'] || 0),
      });
    });
    next();
  };
}

module.exports = { log, middleware };
