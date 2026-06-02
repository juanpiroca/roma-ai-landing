'use strict';

function validateText(value, max) {
  return typeof value === 'string' && value.length <= max;
}

function validateObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { validateText, validateObject };
