const { baseCommand, showList } = require('./common');

module.exports = baseCommand({
  name: 'livelist',
  alias: ['directolist', 'directoslist'],
  usage: 'livelist',
  description: 'Muestra los canales registrados para alertas de directos.',
  execute: async (_Moxi, message) => showList(message),
});
