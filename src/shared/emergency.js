// Protocolo de Emergencia — monitoreo de endpoints + alerta Telegram
// Sin bases de datos, sin dependencias pesadas

const fs  = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '../../error_log.txt');

const ENDPOINTS = [
  { name: 'n8n MCP',    url: 'https://n8n.combonix.com/mcp-server/http' },
  { name: 'WP Admin',   url: 'https://workflow.dementetv.com/wp-login.php' },
];

async function checkEndpoints() {
  const axios = require('axios');
  const results = [];
  for (const ep of ENDPOINTS) {
    try {
      const { status } = await axios.get(ep.url, { timeout: 8000, maxRedirects: 3 });
      results.push({ ...ep, status, ok: status < 500 });
    } catch(e) {
      results.push({ ...ep, status: 0, ok: false, error: e.message });
      fs.appendFileSync(LOG, `[emergency] ${ep.name} DOWN: ${e.message}\n`);
    }
  }
  return results;
}

async function alertTelegram(message) {
  const token   = process.env.TELEGRAM_TOKEN;
  const chatId  = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    fs.appendFileSync(LOG, '[emergency] TELEGRAM_TOKEN o TELEGRAM_ADMIN_CHAT_ID no definidos\n');
    return false;
  }
  try {
    await require('axios').post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: `🚨 *ROMA ALERT*\n${message}`,
      parse_mode: 'Markdown'
    });
    return true;
  } catch(e) {
    fs.appendFileSync(LOG, `[emergency-alert] ${e.message}\n`);
    return false;
  }
}

// Llamar desde cron o endpoint — verifica y alerta si hay caída
async function runCheck() {
  const results = await checkEndpoints();
  const down = results.filter(r => !r.ok);
  if (down.length) {
    const msg = down.map(d => `❌ ${d.name} (${d.url}) — ${d.error || 'HTTP ' + d.status})`).join('\n');
    await alertTelegram(`Endpoints caídos:\n${msg}\n\nIntentando restart automático via Roma...`);
  }
  return { results, down: down.length };
}

module.exports = { runCheck, checkEndpoints, alertTelegram };
