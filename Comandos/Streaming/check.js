const { baseCommand, checkSubscription } = require('./_common');

module.exports = baseCommand({
  name: 'streamcheck',
  alias: ['livecheck', 'directocheck', 'directoscheck'],
  usage: 'streamcheck <twitch|youtube|kick> <usuario>',
  description: 'Comprueba ahora mismo si un canal está en directo.',
  execute: async (_Moxi, message, args) => checkSubscription(message, args[0], args.slice(1).join(' ')),
});
