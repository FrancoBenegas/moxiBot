const { baseCommand, setEnabled } = require('./_common');

module.exports = baseCommand({
  name: 'streamon',
  alias: ['liveon', 'directoon', 'directoson'],
  usage: 'streamon',
  description: 'Activa las alertas de directos.',
  execute: async (_Moxi, message) => setEnabled(message, true),
});
