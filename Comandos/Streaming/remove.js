const { baseCommand, removeSubscriptionCommand } = require('./_common');

module.exports = baseCommand({
  name: 'streamremove',
  alias: ['liveremove', 'directoremove', 'directodel'],
  usage: 'streamremove <twitch|youtube|kick> <usuario>',
  description: 'Elimina un canal de la lista de alertas de directos.',
  execute: async (_Moxi, message, args) => removeSubscriptionCommand(message, args[0], args.slice(1).join(' ')),
});
