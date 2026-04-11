const { baseCommand, setEnabled } = require('./common');

module.exports = baseCommand({
  name: 'liveon',
  alias: ['directoon', 'directoson'],
  usage: 'liveon',
  description: 'Activa las alertas de directos.',
  execute: async (_Moxi, message) => setEnabled(message, true),
});
