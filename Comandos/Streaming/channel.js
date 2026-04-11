const { baseCommand, setChannel } = require('./common');

module.exports = baseCommand({
  name: 'livecanal',
  alias: ['directocanal', 'directoscanal'],
  usage: 'livecanal #canal',
  description: 'Configura el canal donde se enviarán las alertas de directos.',
  execute: async (_Moxi, message, args) => setChannel(message, args[0]),
});
