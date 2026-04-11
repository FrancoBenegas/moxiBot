const { baseCommand, checkSubscription } = require('./common');

module.exports = baseCommand({
  name: 'livecheck',
  alias: ['directocheck', 'directoscheck'],
  usage: 'livecheck <twitch|youtube|kick> <usuario>',
  description: 'Comprueba ahora mismo si un canal está en directo.',
  execute: async (_Moxi, message, args) => checkSubscription(message, args[0], args.slice(1).join(' ')),
});
