/**
 * migrate-leads.js — Migración única de leads JSON a WordPress REST API.
 *
 * Lee todos los archivos JSON en /runtime/leads/ y los sincroniza con WordPress
 * usando el módulo wp-sync.js.
 *
 * Uso:
 *   node migrate-leads.js
 *
 * Requiere variables de entorno:
 *   WP_BASE_URL, WP_API_USER, WP_APP_PASSWORD, WP_DEFAULT_CLIENT_ID
 */

const fs = require('fs');
const path = require('path');
const { syncLead } = require('./wp-sync');

const LEADS_DIR = process.env.LEADS_DIR || path.join(__dirname, '../../runtime/leads');
const DEFAULT_CLIENT_ID = process.env.WP_DEFAULT_CLIENT_ID || '1';

async function migrate() {
  // Verificar que el directorio existe
  if (!fs.existsSync(LEADS_DIR)) {
    console.error(`[migrate] Directorio no encontrado: ${LEADS_DIR}`);
    console.error('[migrate] Crea el directorio o define LEADS_DIR env var.');
    process.exit(1);
  }

  const files = fs.readdirSync(LEADS_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('[migrate] No hay archivos JSON para migrar en:', LEADS_DIR);
    process.exit(0);
  }

  console.log(`[migrate] Migrando ${files.length} leads a WordPress...`);
  console.log(`[migrate] WordPress API: ${process.env.WP_BASE_URL || 'http://127.0.0.1:8090'}`);
  console.log('');

  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const filePath = path.join(LEADS_DIR, file);
    let lead;

    try {
      lead = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error(`✗ ${file}: error de parseo JSON — ${err.message}`);
      fail++;
      continue;
    }

    const result = await syncLead({
      name: lead.name || lead.userName || lead.sessionId || 'Desconocido',
      phone: lead.phone || lead.sessionId || `unknown-${Date.now()}`,
      channel: lead.channel || 'webchat',
      score: typeof lead.score === 'number' ? lead.score : 50,
      stage: lead.stage || 'new',
      lastMessage: lead.lastMessage || lead.message || '',
      clientId: lead.clientId || lead.client_id || DEFAULT_CLIENT_ID,
      source: lead.source || lead.url || '',
    });

    if (result.success) {
      ok++;
      console.log(`✓ ${file} → lead ID ${result.leadId}`);
    } else {
      fail++;
      console.error(`✗ ${file}:`, typeof result.error === 'object' ? JSON.stringify(result.error) : result.error);
    }

    // Throttle para no saturar la API de WordPress
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('');
  console.log(`[migrate] Migración completa: ${ok} ok, ${fail} fallidos`);
  console.log(`[migrate] Total procesados: ${files.length}`);

  process.exit(fail > 0 ? 1 : 0);
}

migrate().catch(err => {
  console.error('[migrate] Error fatal:', err.message);
  process.exit(1);
});
