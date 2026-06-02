'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '../../config/workflow-contracts.json');

let cache = null;
let mtime = 0;

function load() {
  const stat = fs.statSync(FILE);
  if (!cache || stat.mtimeMs > mtime) {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    mtime = stat.mtimeMs;
  }
  return cache;
}

function findById(id) {
  const data = load();
  return (data.workflows || []).find((workflow) => workflow.id === id) || null;
}

function findByComando(command) {
  const data = load();
  return (data.workflows || []).find((workflow) => workflow.comando_roma === command) || null;
}

function validatePayload(contract, payload) {
  const errors = [];
  const schema = contract?.payload_requerido || {};
  for (const [field, spec] of Object.entries(schema)) {
    const value = payload?.[field];
    if (spec.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, error: 'required' });
      continue;
    }
    if (value === undefined) continue;
    if (spec.type === 'string' && typeof value !== 'string') errors.push({ field, error: 'type_string' });
    else if (spec.type === 'number' && typeof value !== 'number') errors.push({ field, error: 'type_number' });
    else if (spec.type === 'boolean' && typeof value !== 'boolean') errors.push({ field, error: 'type_boolean' });
    else if (spec.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) errors.push({ field, error: 'type_object' });
    if (spec.max && typeof value === 'string' && value.length > spec.max) errors.push({ field, error: 'max_length' });
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { load, findById, findByComando, validatePayload };
