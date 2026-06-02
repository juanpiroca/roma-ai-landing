const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Anthropic } = require('@anthropic-ai/sdk');
const memory = require('./memory');
const { appendUsageLog } = require('./claude');

function isImageMime(mime) {
  return /^image\/(jpeg|png|gif|webp)$/i.test(String(mime || ''));
}

function readUtf8Safe(filePath, maxChars = 12000) {
  return fs.readFileSync(filePath, 'utf8').slice(0, maxChars);
}

function extractPdfText(filePath, maxChars = 12000) {
  try {
    return execFileSync('pdftotext', [filePath, '-'], {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 4 * 1024 * 1024,
    }).slice(0, maxChars);
  } catch (_) {
    return '';
  }
}

function extractTextFromDocument(filePath, mime, fileName) {
  const ext = path.extname(fileName || filePath).toLowerCase();
  if (String(mime || '').toLowerCase() === 'application/pdf' || ext === '.pdf') {
    const pdfText = extractPdfText(filePath);
    if (pdfText.trim()) return pdfText;
    return '[PDF recibido pero no se pudo extraer texto localmente]';
  }

  const textLike = new Set([
    '.txt', '.md', '.json', '.csv', '.js', '.ts', '.tsx', '.jsx', '.py',
    '.html', '.css', '.xml', '.yml', '.yaml', '.sql', '.sh',
  ]);

  if (textLike.has(ext) || /^text\//i.test(String(mime || ''))) {
    return readUtf8Safe(filePath);
  }

  return '[Documento recibido. El formato es válido, pero no tiene extractor local disponible.]';
}

async function analyzeImageWithClaude({ filePath, mime, fileName, caption = '', channel = 'telegram-admin', metadata = {} }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');
  const client = new Anthropic({ apiKey });
  const imageBase64 = fs.readFileSync(filePath).toString('base64');
  const userText = [
    `El usuario envió una imagen llamada "${fileName || path.basename(filePath)}".`,
    caption ? `Contexto del usuario: ${caption}` : 'No hay contexto adicional.',
    'Describí lo visible y respondé de forma útil, breve y accionable.',
  ].join('\n');

  const system = memory.buildSystemPrompt(channel);
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: imageBase64 } },
        { type: 'text', text: userText },
      ],
    }],
  });

  const reply = msg.content?.[0]?.text || '';
  appendUsageLog(msg.usage, 'claude-sonnet-4-6');
  memory.appendMessage({ channel, role: 'user', content: `[imagen] ${fileName || path.basename(filePath)}${caption ? `\n${caption}` : ''}`, metadata });
  memory.appendMessage({ channel, role: 'assistant', content: reply, metadata });
  return reply;
}

module.exports = {
  isImageMime,
  extractTextFromDocument,
  analyzeImageWithClaude,
};
