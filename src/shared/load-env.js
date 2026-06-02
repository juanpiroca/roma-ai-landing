const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');

const CANDIDATES = [
  path.join(ROOT, '.env'),
  path.join(ROOT, 'config/.env.local'),
  path.join(ROOT, 'config/.env'),
  path.join(process.cwd(), '.env'),
];

let loaded = false;

function parseEnvFile(content) {
  const out = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

function loadEnv() {
  if (loaded) return;
  loaded = true;

  for (const filePath of CANDIDATES) {
    if (!fs.existsSync(filePath)) continue;
    const parsed = parseEnvFile(fs.readFileSync(filePath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

module.exports = {
  loadEnv,
  parseEnvFile,
  CANDIDATES,
};
