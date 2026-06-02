// Filtro de Requerimientos — Nodo Entrevistador
// Bloquea ejecución de proyectos sin status:"verified"

const sessions = new Map(); // chatId -> estado de entrevista

const QUESTIONS = [
  { key: 'nombre_nicho', text: '1/4 — *Nombre y Nicho*\n¿Cuál es el nombre del negocio y su rubro? (Ej: Barber Pub / Gastronomía)' },
  { key: 'estructura',   text: '2/4 — *Estructura*\n¿Qué secciones necesita el sitio? (Ej: Inicio, Servicios, Galería, Contacto)' },
  { key: 'estetica',     text: '3/4 — *Estética*\n¿Estilo visual? (Default: Premium/Masculino — Madera, Oro, Verde)' },
  { key: 'funcionalidad',text: '4/4 — *Funcionalidad Clave*\n¿Qué funciones necesita? (Ej: Reservas, Tienda, Portafolio)' },
];

function startInterview(chatId) {
  sessions.set(chatId, { step: 0, data: {}, status: 'interviewing' });
  return QUESTIONS[0].text;
}

function handleMessage(chatId, text) {
  const session = sessions.get(chatId);
  if (!session) return null; // no hay entrevista activa

  if (session.status === 'awaiting_confirm') {
    if (text.trim().toUpperCase() === 'PROCEDER') {
      session.status = 'verified';
      session.data.status = 'verified';
      return { type: 'verified', project_data: session.data };
    }
    return { type: 'waiting', text: 'Escribe *PROCEDER* para confirmar o corrígeme algo antes.' };
  }

  // Guardar respuesta actual
  const q = QUESTIONS[session.step];
  session.data[q.key] = text.trim() || _default(q.key);
  session.step++;

  // Siguiente pregunta
  if (session.step < QUESTIONS.length) {
    return { type: 'question', text: QUESTIONS[session.step].text };
  }

  // Todas respondidas → resumen
  session.status = 'awaiting_confirm';
  return { type: 'summary', text: buildSummary(session.data) };
}

function buildSummary(d) {
  return [
    '✅ *Resumen técnico del proyecto*',
    `• Nombre/Nicho: ${d.nombre_nicho}`,
    `• Estructura: ${d.estructura}`,
    `• Estética: ${d.estetica}`,
    `• Funcionalidad: ${d.funcionalidad}`,
    '',
    'Responde *PROCEDER* para generar el proyecto o corrígeme algo.',
  ].join('\n');
}

function _default(key) {
  if (key === 'estetica') return 'Premium/Masculino — Madera, Oro, Verde';
  return '(sin especificar)';
}

function clearSession(chatId) {
  sessions.delete(chatId);
}

function isActive(chatId) {
  return sessions.has(chatId);
}

module.exports = { startInterview, handleMessage, clearSession, isActive };
