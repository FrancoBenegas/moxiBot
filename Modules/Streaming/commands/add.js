const { baseCommand, addSubscription } = require('./_common');

module.exports = baseCommand({
  name: 'streamadd',
  alias: ['liveadd', 'directoadd', 'directosadd'],
  usage: 'streamadd <twitch|youtube|kick> <usuario>',
  description: 'Añade un canal a la lista de alertas de directos.',
  execute: async (_Moxi, message, args) => addSubscription(message, args[0], args.slice(1).join(' ')),
});
