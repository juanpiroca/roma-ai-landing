const axios = require('axios');
const { loadEnv } = require('./load-env');

loadEnv();

function formatMessage(event) {
  const icons = { tool_use: '🔧', edit: '✏️', bash: '💻', permission: '🔐', info: 'ℹ️' };
  const icon = icons[event.type] || '📋';
  return `${icon} *Roma VS Code*\n*${event.tool || event.type}*\n\`${String(event.detail || '').slice(0, 200)}\``;
}

async function broadcastActivity(event) {
  const msg = formatMessage(event);
  const promises = [];

  if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    promises.push(
      axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: 'Markdown',
      }).catch(() => {})
    );
  }

  promises.push(
    axios.post('http://127.0.0.1:3010/api/activity/log', { event }).catch(() => {})
  );

  await Promise.all(promises);
}

module.exports = { broadcastActivity, formatMessage };
