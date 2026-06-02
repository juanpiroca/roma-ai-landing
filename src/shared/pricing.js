'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'config', 'pricing.json');

const DEFAULT_CONFIG = {
  categories: {
    landing: { base: 500, min: 300, max: 1200 },
    web_corp: { base: 1500, min: 800, max: 3500 },
    ecommerce: { base: 3000, min: 1500, max: 8000 },
    app_mobile: { base: 5000, min: 3000, max: 15000 },
    automatizacion: { base: 800, min: 400, max: 2500 },
    consultoria: { base: 200, min: 100, max: 400, unit: 'hr' },
    otros: { base: 1000, min: 500, max: 3000 },
  },
  multipliers: {
    timeline_urgencia: { '<1sem': 1.5, '2-4sem': 1.0, '>1mes': 0.9 },
    complejidad: { simple: 0.8, media: 1.0, compleja: 1.4 },
    formato: { 'one-shot': 1.0, mensual: 0.7, retainer: 0.85 },
  },
};

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (_) {
    return DEFAULT_CONFIG;
  }
}

function parseBudget(budget) {
  if (budget == null) return null;
  const digits = String(budget).replace(/[^\d.,-]/g, ' ').match(/\d+(?:[.,]\d+)?/g);
  if (!digits || !digits.length) return null;
  const nums = digits.map((value) => Number(value.replace(',', '.'))).filter(Number.isFinite);
  if (!nums.length) return null;
  return Math.max(...nums);
}

function inferCategory(project = '') {
  const t = String(project).toLowerCase();
  if (/consultor/i.test(t)) return 'consultoria';
  if (/landing/.test(t)) return 'landing';
  if (/e-?commerce|tienda|shop|catalogo|catálogo/.test(t)) return 'ecommerce';
  if (/app|ios|android|mobile/.test(t)) return 'app_mobile';
  if (/automatiz|workflow|crm|bot|integraci/.test(t)) return 'automatizacion';
  if (/institucional|corporativa|empresa|web/.test(t)) return 'web_corp';
  return 'otros';
}

function inferTimelineBucket(text = '') {
  const t = String(text).toLowerCase();
  if (/urgente|ya|hoy|mañana|esta semana|esta misma semana|menos de una semana|rápido/.test(t)) return '<1sem';
  if (/2 semanas|dos semanas|3 semanas|tres semanas|4 semanas|cuatro semanas|este mes|2-4/.test(t)) return '2-4sem';
  return '>1mes';
}

function inferComplexity(text = '') {
  const t = String(text).toLowerCase();
  if (/simple|basic|básic|landing|one pager|una pagina/.test(t)) return 'simple';
  if (/complej|integraci|multi|marketplace|app|saas|automatiz/.test(t)) return 'compleja';
  return 'media';
}

function inferFormat(text = '') {
  const t = String(text).toLowerCase();
  if (/mensual|mes a mes|por mes/.test(t)) return 'mensual';
  if (/retainer|abono|bolsa de horas/.test(t)) return 'retainer';
  return 'one-shot';
}

function defaultScope(category) {
  const scopes = {
    landing: ['Discovery corto y estructura de landing', 'Diseño y copy inicial', 'Implementación y ajustes finales'],
    web_corp: ['Arquitectura de sitio corporativo', 'Contenido y diseño por secciones', 'Implementación y QA'],
    ecommerce: ['Catálogo y flujo de compra', 'Integraciones clave de venta', 'Setup operativo y QA'],
    app_mobile: ['Definición funcional del MVP', 'UX principal y pantallas críticas', 'Desarrollo inicial y pruebas'],
    automatizacion: ['Mapeo del proceso actual', 'Diseño del flujo automatizado', 'Implementación y monitoreo inicial'],
    consultoria: ['Diagnóstico del caso', 'Sesión de trabajo guiada', 'Plan técnico y próximos pasos'],
    otros: ['Relevamiento de alcance', 'Definición de solución', 'Implementación inicial'],
  };
  return scopes[category] || scopes.otros;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function estimate(lead = {}) {
  const config = loadConfig();
  const category = inferCategory(lead.project);
  const timelineBucket = inferTimelineBucket(lead.timeline);
  const complexity = inferComplexity(`${lead.project || ''} ${lead.description || ''}`);
  const format = inferFormat(lead.budget || lead.format || lead.project);
  const budgetDeclared = parseBudget(lead.budget);
  const table = config.categories[category] || config.categories.otros;

  const estimateValue = table.base
    * (config.multipliers.complejidad[complexity] || 1)
    * (config.multipliers.timeline_urgencia[timelineBucket] || 1)
    * (config.multipliers.formato[format] || 1);

  let min;
  let max;
  let pricingConflict = false;

  if (budgetDeclared && estimateValue > budgetDeclared * 1.5) {
    min = budgetDeclared * 0.9;
    max = budgetDeclared * 1.2;
    pricingConflict = true;
  } else {
    min = estimateValue * 0.85;
    max = estimateValue * 1.15;
  }

  min = clamp(Math.round(min), table.min, table.max);
  max = clamp(Math.round(max), table.min, table.max);
  if (min > max) min = max;

  return {
    category,
    timeline_bucket: timelineBucket,
    complexity,
    format,
    estimate: Math.round(estimateValue),
    min,
    max,
    pricing_conflict: pricingConflict,
    budget_declared: budgetDeclared,
    scope: defaultScope(category),
    timeline_weeks: timelineBucket === '<1sem' ? 1 : timelineBucket === '2-4sem' ? 2 : 6,
  };
}

module.exports = { estimate, inferCategory, inferTimelineBucket, inferComplexity, inferFormat, parseBudget };
