const { baseCommand, addSubscription } = require('./common');

module.exports = baseCommand({
  name: 'liveadd',
  alias: ['directoadd', 'directosadd'],
  usage: 'liveadd <twitch|youtube|kick> <usuario>',
  description: 'Añade un canal a la lista de alertas de directos.',
  execute: async (_Moxi, message, args) => addSubscription(message, args[0], args.slice(1).join(' ')),
});
