const fs = require('fs');
const path = require('path');

const ACTION_LOG = path.join(process.cwd(), 'logs', 'actions.log');

function logAction(action, origin, result, error = null, metadata = {}) {
  try {
    fs.mkdirSync(path.dirname(ACTION_LOG), { recursive: true });
    fs.appendFileSync(ACTION_LOG, JSON.stringify({
      ts: new Date().toISOString(),
      action,
      origin,
      result,
      error: error ? String(error) : null,
      ...metadata,
    }) + '\n');
  } catch (_) {}
}

module.exports = { ACTION_LOG, logAction };
