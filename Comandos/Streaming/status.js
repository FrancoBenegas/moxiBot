const { baseCommand, showStatus } = require('./common');

module.exports = baseCommand({
  name: 'lifestatus',
  alias: ['directostatus', 'directoestado'],
  usage: 'lifestatus',
  description: 'Muestra el estado de las alertas de directos.',
  execute: async (_Moxi, message) => showStatus(message),
});
