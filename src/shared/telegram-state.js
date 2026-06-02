const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), 'data', 'telegram-state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (_) {
    return { chats: {} };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getChatState(chatId) {
  const state = readState();
  const key = String(chatId);
  if (!state.chats[key]) {
    state.chats[key] = { responseMode: 'text', lastAssistantText: '', updatedAt: new Date().toISOString() };
    writeState(state);
  }
  return state.chats[key];
}

function updateChatState(chatId, patch) {
  const state = readState();
  const key = String(chatId);
  const current = state.chats[key] || { responseMode: 'text', lastAssistantText: '' };
  // Log mode changes for debugging
  if (patch.responseMode && patch.responseMode !== current.responseMode) {
    console.log(`[telegram-state] chatId=${chatId} responseMode: ${current.responseMode} → ${patch.responseMode} at ${new Date().toISOString()}`);
  }
  state.chats[key] = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeState(state);
  return state.chats[key];
}

// Llamar al arrancar el bot: resetea responseMode a 'text' para todos los chats.
// El modo audio nunca persiste entre reinicios — debe activarse explícitamente cada sesión.
function resetAllModesToText() {
  const state = readState();
  let changed = 0;
  for (const [key, chat] of Object.entries(state.chats || {})) {
    if (chat.responseMode !== 'text') {
      console.log(`[telegram-state] RESET chatId=${key} responseMode: ${chat.responseMode} → text (startup reset)`);
      state.chats[key] = { ...chat, responseMode: 'text', updatedAt: new Date().toISOString() };
      changed++;
    }
  }
  if (changed > 0) writeState(state);
  console.log(`[telegram-state] Startup: ${changed} chat(s) reseteados a modo texto.`);
}

module.exports = { STATE_FILE, getChatState, updateChatState, resetAllModesToText };
