const path = require('path');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'text/x-python',
  'application/xml',
  'text/xml',
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.py', '.sh', '.json', '.md', '.txt',
  '.html', '.css', '.xml', '.yml', '.yaml', '.sql',
]);

function parseChatIds(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function getAuthorizedChatIds() {
  return new Set([
    ...parseChatIds(process.env.ALLOWED_CHAT_ID),
    ...parseChatIds(process.env.TELEGRAM_CHAT_ID),
  ]);
}

function getPrimaryAuthorizedChatId() {
  return parseChatIds(process.env.ALLOWED_CHAT_ID)[0] || null;
}

function isAuthorizedChat(chatId) {
  return getAuthorizedChatIds().has(String(chatId));
}

function canProcessAttachments(chatId) {
  const primary = getPrimaryAuthorizedChatId();
  return Boolean(primary) && String(chatId) === primary;
}

function isAllowedDocumentFile(doc) {
  const mime = String(doc?.mime_type || '').toLowerCase();
  const ext = path.extname(doc?.file_name || '').toLowerCase();
  return ALLOWED_MIME.has(mime) || CODE_EXTENSIONS.has(ext);
}

module.exports = {
  ALLOWED_MIME,
  CODE_EXTENSIONS,
  getAuthorizedChatIds,
  getPrimaryAuthorizedChatId,
  isAuthorizedChat,
  canProcessAttachments,
  isAllowedDocumentFile,
};
