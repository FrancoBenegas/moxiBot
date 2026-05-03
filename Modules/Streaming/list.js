const { baseCommand, showList } = require('./_common');

module.exports = baseCommand({
  name: 'streamlist',
  alias: ['livelist', 'directolist', 'directoslist'],
  usage: 'streamlist',
  description: 'Muestra los canales registrados para alertas de directos.',
  execute: async (_Moxi, message) => showList(message),
});
