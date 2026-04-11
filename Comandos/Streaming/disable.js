const { baseCommand, setEnabled } = require('./_common');

module.exports = baseCommand({
  name: 'streamoff',
  alias: ['liveoff', 'directooff', 'directosoff'],
  usage: 'streamoff',
  description: 'Desactiva las alertas de directos.',
  execute: async (_Moxi, message) => setEnabled(message, false),
});
