'use strict';

const telegramPolicy = require('./telegram-policy');
const telegramState = require('./telegram-state');

module.exports = {
  ...telegramPolicy,
  ...telegramState,
};
