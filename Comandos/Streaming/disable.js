const { baseCommand, setEnabled } = require('./common');

module.exports = baseCommand({
  name: 'liveoff',
  alias: ['directooff', 'directosoff'],
  usage: 'liveoff',
  description: 'Desactiva las alertas de directos.',
  execute: async (_Moxi, message) => setEnabled(message, false),
});
