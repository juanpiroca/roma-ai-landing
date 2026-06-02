const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(process.cwd(), 'data', 'exports');

function safeName(name) {
  return String(name || 'roma-chat')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80) || 'roma-chat';
}

function ensureDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function buildMarkdown(title, entries) {
  const lines = [`# ${title}`, '', `Exportado: ${new Date().toISOString()}`, ''];
  for (const entry of entries) {
    const role = entry.role === 'assistant' ? 'Roma' : 'Juanpi';
    const ts = entry.ts || '';
    lines.push(`## ${role}${ts ? ` — ${ts}` : ''}`);
    lines.push('');
    lines.push(String(entry.content || '').trim() || '(vacío)');
    lines.push('');
  }
  return lines.join('\n');
}

function pdfEscape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(title, entries) {
  const bodyLines = [title, '', ...entries.flatMap((entry) => {
    const role = entry.role === 'assistant' ? 'Roma' : 'Juanpi';
    return [`${role}: ${String(entry.content || '').replace(/\s+/g, ' ').trim()}`, ''];
  })].slice(0, 80);

  const content = ['BT', '/F1 12 Tf', '50 780 Td', ...bodyLines.map((line, idx) => `${idx === 0 ? '' : '0 -16 Td'} (${pdfEscape(line)}) Tj`), 'ET'].join('\n');
  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objects.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj');
  objects.push('4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');
  objects.push(`5 0 obj<< /Length ${Buffer.byteLength(content, 'utf8')} >>stream\n${content}\nendstream\nendobj`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function exportConversation(title, entries) {
  ensureDir();
  const base = `${Date.now()}-${safeName(title)}`;
  const mdPath = path.join(EXPORT_DIR, `${base}.md`);
  const pdfPath = path.join(EXPORT_DIR, `${base}.pdf`);
  fs.writeFileSync(mdPath, buildMarkdown(title, entries), 'utf8');
  fs.writeFileSync(pdfPath, buildSimplePdf(title, entries));
  return { mdPath, pdfPath };
}

module.exports = { EXPORT_DIR, exportConversation, buildMarkdown };
