const { baseCommand, showStatus } = require('./_common');

module.exports = baseCommand({
  name: 'streamstatus',
  alias: ['lifestatus', 'directostatus', 'directoestado'],
  usage: 'streamstatus',
  description: 'Muestra el estado de las alertas de directos.',
  execute: async (_Moxi, message) => showStatus(message),
});
