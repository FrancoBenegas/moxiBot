const moxi = require('../../../i18n');
const debugHelper = require('../../../Util/debugHelper');
const { ownerPermissions } = require('../../../Util/ownerPermissions');
const { setSession, buildServersPanel } = require('../../../Util/serversPanel');

module.exports = {
    name: 'servers',
    alias: ['guilds', 'servidores'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'servers [limite=25] [buscar...]',
    description: (lang = 'es-ES') =>
        (moxi.translate('SERVERS_CMD_DESC', lang) !== 'SERVERS_CMD_DESC'
            ? moxi.translate('SERVERS_CMD_DESC', lang)
            : 'Muestra los servidores donde esta el bot (solo owners)'),

    async execute(Moxi, message, args) {
        const requesterId = message.author?.id;
        debugHelper.log('servers', 'command start', { requesterId });

        const fakeInteraction = {
            user: message.author,
            memberPermissions: message.member?.permissions,
            guild: message.guild,
        };

        const isOwner = await ownerPermissions(fakeInteraction, Moxi);
        if (!isOwner) {
            return message.reply('Solo los owners pueden usar este comando.');
        }

        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        const rawArgs = Array.isArray(args) ? args : [];
        const maybeLimit = Number(rawArgs[0]);
        const limit = Number.isFinite(maybeLimit) ? Math.max(1, Math.min(50, Math.floor(maybeLimit))) : 25;
        const search = (Number.isFinite(maybeLimit) ? rawArgs.slice(1) : rawArgs).join(' ').trim();

        const token = setSession({
            userId: message.author.id,
            search,
            limit,
            pageSize: 5,
        });

        const { payload } = await buildServersPanel({
            client: Moxi,
            userId: message.author.id,
            token,
            search,
            limit,
            page: 0,
            pageSize: 5,
            t,
        });

        return message.reply(payload);
    },
};
