// report-generator.js — Genera reportes semanales con IA y los guarda en WordPress
// Fase 7: Sistema de reportes IA
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');

const CONFIG = {
  dockerContainer: process.env.WP_DOCKER_CONTAINER || 'roma-wordpress',
  dockerCmd: process.env.DOCKER_CMD || '/usr/bin/docker',
  deepseekKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  wpBase: process.env.WP_BASE_URL || 'http://127.0.0.1:8090',
  wpUser: process.env.WP_API_USER || 'roma-node',
  wpPass: process.env.WP_APP_PASSWORD || '',
  clientId: process.env.WP_DEFAULT_CLIENT_ID || '1',
};

function execFileAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 2 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) { err.stdout = stdout; err.stderr = stderr; return reject(err); }
      resolve({ stdout, stderr });
    });
  });
}

function httpRequest(method, urlStr, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function isoWeek(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function weekRange(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function toISO(d) { return d.toISOString().slice(0, 10); }

async function fetchLeadsViaDocker(afterDate, beforeDate) {
  const php = `
$args = [
  'post_type'      => 'roma_lead',
  'post_status'    => ['publish'],
  'posts_per_page' => -1,
  'date_query'     => [['after' => '${afterDate}', 'before' => '${beforeDate}', 'inclusive' => true]],
];
$posts = get_posts($args);
$leads = [];
foreach ($posts as $p) {
  $leads[] = [
    'id'      => $p->ID,
    'name'    => $p->post_title,
    'channel' => get_post_meta($p->ID, '_channel', true),
    'score'   => (int) get_post_meta($p->ID, '_score', true),
    'stage'   => get_post_meta($p->ID, '_stage', true),
    'date'    => $p->post_date,
  ];
}
echo wp_json_encode($leads);
`;
  const { stdout } = await execFileAsync(CONFIG.dockerCmd, [
    'exec', CONFIG.dockerContainer, 'wp', 'eval', '--allow-root', php,
  ]);
  return JSON.parse(stdout.trim() || '[]');
}

async function generateReportText(thisWeekLeads, prevWeekLeads) {
  const channels = {};
  for (const l of thisWeekLeads) {
    channels[l.channel || 'unknown'] = (channels[l.channel || 'unknown'] || 0) + 1;
  }
  const topChannel = Object.entries(channels).sort((a, b) => b[1] - a[1])[0];
  const avgScore = thisWeekLeads.length
    ? Math.round(thisWeekLeads.reduce((s, l) => s + (l.score || 0), 0) / thisWeekLeads.length)
    : 0;
  const delta = thisWeekLeads.length - prevWeekLeads.length;
  const deltaText = delta > 0 ? `+${delta} vs semana anterior` : delta < 0 ? `${delta} vs semana anterior` : 'igual que la semana anterior';

  const prompt = `Sos el asistente de análisis de ROMA AI. Genera un reporte semanal breve y motivador en español para un dueño de negocio latino en EEUU.

Datos de esta semana:
- Total de leads: ${thisWeekLeads.length} (${deltaText})
- Canal más activo: ${topChannel ? `${topChannel[0]} (${topChannel[1]} leads)` : 'sin datos'}
- Score promedio: ${avgScore}/100
- Canales activos: ${Object.entries(channels).map(([k, v]) => `${k}: ${v}`).join(', ') || 'ninguno'}
- Semana anterior: ${prevWeekLeads.length} leads

Estructura:
1. Resumen ejecutivo (2 oraciones)
2. Punto fuerte de la semana
3. Oportunidad de mejora
4. Mensaje de cierre motivador

Tono: profesional pero cercano. Máximo 200 palabras. Sin markdown, solo texto plano.`;

  const res = await httpRequest(
    'POST',
    `${CONFIG.deepseekUrl}/chat/completions`,
    { model: CONFIG.deepseekModel, messages: [{ role: 'user', content: prompt }], max_tokens: 400 },
    { Authorization: `Bearer ${CONFIG.deepseekKey}` }
  );

  if (res.status !== 200) throw new Error(`DeepSeek error ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.choices?.[0]?.message?.content?.trim() || 'Sin contenido generado.';
}

async function saveReportToWP(period, contentText, clientId) {
  const contentHtml = contentText
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  const payload = {
    period,
    clientId: String(clientId),
    contentHtml,
    sentAt: new Date().toISOString(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');

  const php = `
$p = json_decode(base64_decode('${encoded}'), true);
$existing = get_posts([
  'post_type'      => 'roma_report',
  'post_status'    => ['publish','draft'],
  'posts_per_page' => 1,
  'fields'         => 'ids',
  'meta_query'     => [
    ['key' => '_period',    'value' => $p['period']],
    ['key' => '_client_id', 'value' => $p['clientId']],
  ],
]);
if (!empty($existing)) {
  update_post_meta($existing[0], '_content_html', $p['contentHtml']);
  update_post_meta($existing[0], '_sent_at',     $p['sentAt']);
  echo wp_json_encode(['id' => (int)$existing[0], 'status' => 'updated']);
  exit;
}
$id = wp_insert_post([
  'post_title'  => 'Reporte semana ' . $p['period'],
  'post_type'   => 'roma_report',
  'post_status' => 'publish',
]);
if (is_wp_error($id)) { fwrite(STDERR, $id->get_error_message()); exit(1); }
update_post_meta($id, '_client_id',    $p['clientId']);
update_post_meta($id, '_period',       $p['period']);
update_post_meta($id, '_content_html', $p['contentHtml']);
update_post_meta($id, '_sent_at',      $p['sentAt']);
echo wp_json_encode(['id' => (int)$id, 'status' => 'created']);
`;

  const { stdout } = await execFileAsync(CONFIG.dockerCmd, [
    'exec', CONFIG.dockerContainer, 'wp', 'eval', '--allow-root', php,
  ]);
  return JSON.parse(stdout.trim() || '{}');
}

async function generateWeeklyReport(clientId = CONFIG.clientId) {
  const thisWeek = weekRange(0);
  const prevWeek = weekRange(-1);
  const period = `${toISO(thisWeek.start)}/${toISO(thisWeek.end)}`;

  console.log(`[report] Generando reporte para período ${period} (client_id=${clientId})`);

  const [thisLeads, prevLeads] = await Promise.all([
    fetchLeadsViaDocker(toISO(thisWeek.start), toISO(thisWeek.end)),
    fetchLeadsViaDocker(toISO(prevWeek.start), toISO(prevWeek.end)),
  ]);

  console.log(`[report] Esta semana: ${thisLeads.length} leads | Semana anterior: ${prevLeads.length} leads`);

  if (thisLeads.length === 0 && prevLeads.length === 0) {
    console.log('[report] Sin datos suficientes para generar reporte — omitiendo.');
    return null;
  }

  const text = await generateReportText(thisLeads, prevLeads);
  console.log(`[report] Texto generado (${text.length} chars)`);

  const result = await saveReportToWP(period, text, clientId);
  console.log(`[report] Guardado en WP: ID=${result.id} status=${result.status}`);

  return { period, leadCount: thisLeads.length, wpId: result.id, status: result.status };
}

module.exports = { generateWeeklyReport };

if (require.main === module) {
  generateWeeklyReport()
    .then(r => { if (r) console.log('[report] Completado:', JSON.stringify(r)); })
    .catch(e => { console.error('[report] Error:', e.message); process.exit(1); });
}
