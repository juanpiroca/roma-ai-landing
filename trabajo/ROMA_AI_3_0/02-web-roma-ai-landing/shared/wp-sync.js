// wp-sync.js — Sincroniza leads/conversaciones con WordPress REST API
// Fase 4/6: Integración Node.js → WordPress
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');

const WP_CONFIG = {
  baseUrl: process.env.WP_BASE_URL || 'http://127.0.0.1:8090',
  namespace: 'roma/v1',
  username: process.env.WP_API_USER || process.env.WP_USER || 'roma-node',
  appPassword: process.env.WP_APP_PASSWORD || '',
  dockerContainer: process.env.WP_DOCKER_CONTAINER || process.env.DOCKER_WP_CONTAINER || 'roma-wordpress',
  dockerCmd: process.env.DOCKER_CMD || '/usr/bin/docker',
  // Si WP_SYNC_MODE=docker, salta REST y va directo a WP-CLI
  forceDocker: (process.env.WP_SYNC_MODE || 'auto') === 'docker',
};

function wpAuth() {
  const creds = Buffer.from(`${WP_CONFIG.username}:${WP_CONFIG.appPassword}`).toString('base64');
  return `Basic ${creds}`;
}

async function wpRequest(method, path, body = null) {
  const url = new URL(`${WP_CONFIG.baseUrl}/wp-json/${WP_CONFIG.namespace}${path}`);
  const lib = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': wpAuth(),
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function execFileAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function buildLeadPayload(leadData) {
  const score = Number.isFinite(Number(leadData.score)) ? Number(leadData.score) : 50;
  return {
    name: leadData.name || leadData.phone || 'Desconocido',
    phone: leadData.phone || leadData.name || `unknown-${Date.now()}`,
    channel: leadData.channel || 'webchat',
    score,
    stage: leadData.stage || 'new',
    lastMessage: leadData.lastMessage || '',
    clientId: String(leadData.clientId || '1'),
    source: leadData.source || '',
  };
}

async function wpCliUpsertLead(leadData) {
  const payload = buildLeadPayload(leadData);
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

  const php = String.raw`
$payload = json_decode(base64_decode(getenv('LEAD_PAYLOAD') ?: ''), true);
if (!is_array($payload)) {
  fwrite(STDERR, "invalid_payload\n");
  exit(1);
}
$phone = (string) ($payload['phone'] ?? '');
$client_id = (string) ($payload['clientId'] ?? '1');
$name = sanitize_text_field((string) ($payload['name'] ?? 'Desconocido'));
$last_message = wp_kses_post((string) ($payload['lastMessage'] ?? ''));
$stage = sanitize_text_field((string) ($payload['stage'] ?? 'new'));
$source = sanitize_text_field((string) ($payload['source'] ?? ''));
$score = (int) ($payload['score'] ?? 50);
$existing = get_posts([
  'post_type'      => 'roma_lead',
  'post_status'    => ['publish', 'draft', 'private'],
  'posts_per_page' => 1,
  'fields'         => 'ids',
  'meta_query'     => [
    'relation' => 'AND',
    [ 'key' => '_phone', 'value' => $phone ],
    [ 'key' => '_client_id', 'value' => $client_id ],
  ],
]);
if (!empty($existing)) {
  $lead_id = (int) $existing[0];
  wp_update_post([
    'ID'           => $lead_id,
    'post_title'   => $name,
    'post_content' => $last_message,
  ]);
  update_post_meta($lead_id, '_client_id', $client_id);
  update_post_meta($lead_id, '_phone', $phone);
  update_post_meta($lead_id, '_channel', (string) ($payload['channel'] ?? 'webchat'));
  update_post_meta($lead_id, '_score', $score);
  update_post_meta($lead_id, '_stage', $stage);
  update_post_meta($lead_id, '_source', $source);
  update_post_meta($lead_id, '_last_message_at', current_time('mysql'));
  echo wp_json_encode(['id' => $lead_id, 'status' => 'updated']);
  exit(0);
}
$lead_id = wp_insert_post([
  'post_title'   => $name,
  'post_content' => $last_message,
  'post_type'    => 'roma_lead',
  'post_status'  => 'publish',
]);
if (is_wp_error($lead_id)) {
  fwrite(STDERR, $lead_id->get_error_message() . "\n");
  exit(1);
}
update_post_meta($lead_id, '_client_id', $client_id);
update_post_meta($lead_id, '_phone', $phone);
update_post_meta($lead_id, '_channel', (string) ($payload['channel'] ?? 'webchat'));
update_post_meta($lead_id, '_score', $score);
update_post_meta($lead_id, '_stage', $stage);
update_post_meta($lead_id, '_source', $source);
update_post_meta($lead_id, '_last_message_at', current_time('mysql'));
echo wp_json_encode(['id' => (int) $lead_id, 'status' => 'created']);
`;

  const args = [
    'exec',
    '-e', `LEAD_PAYLOAD=${encoded}`,
    WP_CONFIG.dockerContainer,
    'wp',
    'eval',
    '--allow-root',
    php,
  ];

  const { stdout } = await execFileAsync(WP_CONFIG.dockerCmd, args, { maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim() || '{}');
}

/**
 * Crear o actualizar un lead en WordPress.
 * Si ya existe un lead con el mismo phone + client_id, actualiza el score y stage.
 * @param {Object} leadData
 * @param {string} leadData.name         - Nombre del lead
 * @param {string} leadData.phone        - Teléfono con código de país (+1...)
 * @param {string} leadData.channel      - 'webchat' | 'whatsapp' | 'instagram'
 * @param {number} leadData.score        - 0-100
 * @param {string} leadData.stage        - 'new' | 'active' | 'hot' | 'closed' | 'lost'
 * @param {string} leadData.lastMessage  - Último mensaje del lead
 * @param {string} leadData.clientId     - ID del roma_client en WordPress (post ID)
 * @param {string} [leadData.source]     - URL o identificador de origen
 */
async function syncLead(leadData) {
  // Modo docker-only: salta REST completamente
  if (WP_CONFIG.forceDocker) {
    try {
      const fallback = await wpCliUpsertLead(leadData);
      return { success: true, leadId: fallback.id, transport: 'wp-cli', status: fallback.status };
    } catch (fallbackErr) {
      console.error('[wp-sync] WP-CLI fallback error:', fallbackErr.message, fallbackErr.stderr || '');
      return { success: false, error: fallbackErr.message };
    }
  }

  // Modo normal: intenta REST primero, cae a WP-CLI si falla
  try {
    const result = await wpRequest('POST', '/leads', {
      name: leadData.name,
      phone: leadData.phone,
      channel: leadData.channel,
      score: leadData.score,
      stage: leadData.stage,
      last_message: leadData.lastMessage,
      client_id: leadData.clientId,
      source: leadData.source || '',
    });

    if (result.status === 200 || result.status === 201) {
      return { success: true, leadId: result.body.id, transport: 'rest' };
    }

    // Log diagnóstico del error REST
    const errBody = typeof result.body === 'object' ? JSON.stringify(result.body) : (result.body || '');
    console.error(`[wp-sync] REST ${result.status} — code=${result.body?.code || 'N/A'} message=${result.body?.message || errBody}`);
    console.error('[wp-sync] Verificar: WP_APP_PASSWORD, usuario roma-node, y capabilities');
    console.error('[wp-sync] Intentando fallback WP-CLI...');

    const fallback = await wpCliUpsertLead(leadData);
    return { success: true, leadId: fallback.id, transport: 'wp-cli', status: fallback.status };
  } catch (err) {
    console.error(`[wp-sync] REST error de red: ${err.code || err.message}`);
    console.error('[wp-sync] Intentando fallback WP-CLI...');
    try {
      const fallback = await wpCliUpsertLead(leadData);
      return { success: true, leadId: fallback.id, transport: 'wp-cli', status: fallback.status };
    } catch (fallbackErr) {
      console.error('[wp-sync] WP-CLI fallback error:', fallbackErr.message, fallbackErr.stderr || '');
      console.error('[wp-sync] Asegúrate de que el contenedor Docker exista: docker ps | grep wordpress');
      console.error(`[wp-sync] Buscando contenedor: ${WP_CONFIG.dockerContainer}`);
      return { success: false, error: fallbackErr.message };
    }
  }
}

/**
 * Registrar un mensaje de conversación en WordPress.
 * Se llama para cada turno (usuario y asistente).
 */
async function syncMessage(messageData) {
  try {
    const result = await wpRequest('POST', '/conversations/messages', {
      lead_id: messageData.leadId,
      client_id: messageData.clientId,
      role: messageData.role,       // 'user' | 'assistant'
      content: messageData.content,
      channel: messageData.channel,
    });

    if (result.status === 200 || result.status === 201) {
      return { success: true, transport: 'rest' };
    }

    // Log diagnóstico sin fallback — mensajes no críticos vs lead
    const errBody = typeof result.body === 'object' ? JSON.stringify(result.body) : (result.body || '');
    console.error(`[wp-sync] syncMessage REST ${result.status} — ${result.body?.code || 'N/A'}: ${result.body?.message || errBody}`);
    return { success: false, error: result.body };
  } catch (err) {
    console.error(`[wp-sync] syncMessage error de red: ${err.code || err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Actualizar el stage y score de un lead existente.
 */
async function updateLeadStage(wpLeadId, stage, score) {
  try {
    const result = await wpRequest('PATCH', `/leads/${wpLeadId}`, { stage, score });
    if (result.status === 200) return { success: true, transport: 'rest' };
    return { success: false, error: result.body };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { syncLead, syncMessage, updateLeadStage };
