const { baseCommand, setChannel } = require('./_common');

module.exports = baseCommand({
  name: 'streamcanal',
  alias: ['livecanal', 'directocanal', 'directoscanal'],
  usage: 'streamcanal #canal',
  description: 'Configura el canal donde se enviarán las alertas de directos.',
  execute: async (_Moxi, message, args) => setChannel(message, args[0]),
});
