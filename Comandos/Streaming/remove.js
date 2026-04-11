const { baseCommand, removeSubscriptionCommand } = require('./common');

module.exports = baseCommand({
  name: 'liveremove',
  alias: ['directoremove', 'directodel'],
  usage: 'liveremove <twitch|youtube|kick> <usuario>',
  description: 'Elimina un canal de la lista de alertas de directos.',
  execute: async (_Moxi, message, args) => removeSubscriptionCommand(message, args[0], args.slice(1).join(' ')),
});
