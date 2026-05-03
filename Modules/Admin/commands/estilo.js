const moxi = require('../../../i18n');
const { Bot } = require('../../../Config');
const { EMOJIS } = require('../../../Util/emojis');
const {
    refreshSeasonStyle,
    updateSeasonStyle,
    normalizeSeasonInput,
    normalizeHemisphereInput,
    formatSeasonStatus,
} = require('../../../Util/seasonStyle');

const { PermissionsBitField: { Flags }, ContainerBuilder, MessageFlags } = require('discord.js');

function buildPanel(title, body) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function usage(prefix = '.') {
    return [
        `${prefix}estilo estado`,
        `${prefix}estilo auto`,
        `${prefix}estilo manual <primavera|verano|otono|invierno>`,
        `${prefix}estilo hemisferio <norte|sur>`,
        `${prefix}estilo off`,
        `${prefix}estilo actualizar`,
    ].join('\n');
}

module.exports = {
    name: 'estilo',
    alias: ['seasonstyle', 'estacion', 'season'],
    description: (lang = 'es-ES') => moxi.translate('misc:SEASON_STYLE_DESC', lang) || 'Cambia el estilo global por estaciones (auto/manual/off).',
    usage: 'estilo estado | estilo auto | estilo manual <primavera|verano|otono|invierno> | estilo hemisferio <norte|sur> | estilo off | estilo actualizar',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ADMIN', lang),
    permissions: { User: [Flags.Administrator] },
    cooldown: 5,

    async execute(_Moxi, message, args) {
        const guildId = message.guild?.id || 'dm';
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        if (!message.guild) {
            return message.reply(buildPanel('Estilo estacional', `${EMOJIS.cross} ${moxi.translate('GUILD_ONLY', lang) || 'Solo en servidores.'}`));
        }

        const sub = String(args[0] || 'estado').trim().toLowerCase();

        if (sub === 'estado' || sub === 'status') {
            const snapshot = await refreshSeasonStyle();
            const view = formatSeasonStatus(snapshot);
            return message.reply(buildPanel(
                'Estilo estacional',
                `${EMOJIS.info || ''} Modo: **${view.modeText}**\n` +
                `${EMOJIS.time || ''} Estación activa: **${view.active}**\n` +
                `${EMOJIS.settings || EMOJIS.info || ''} Estación manual: **${view.manual}**\n` +
                `${EMOJIS.channel || ''} Hemisferio: **${view.hemisphere}**\n` +
                `${EMOJIS.paint || '🎨'} Color activo: **${view.color}**`
            ));
        }

        if (sub === 'auto') {
            const snapshot = await updateSeasonStyle({ mode: 'auto' }, { id: message.author?.id, tag: message.author?.tag });
            const view = formatSeasonStatus(snapshot);
            return message.reply(buildPanel('Estilo estacional', `${EMOJIS.tick} Modo automático activado. Estación: **${view.active}** • Color: **${view.color}**`));
        }

        if (sub === 'off' || sub === 'desactivar') {
            const snapshot = await updateSeasonStyle({ mode: 'off' }, { id: message.author?.id, tag: message.author?.tag });
            const view = formatSeasonStatus(snapshot);
            return message.reply(buildPanel('Estilo estacional', `${EMOJIS.tick} Estilo estacional desactivado. Color base activo: **${view.color}**`));
        }

        if (sub === 'manual') {
            const season = normalizeSeasonInput(args[1]);
            if (!season) {
                return message.reply(buildPanel('Estilo estacional', `${EMOJIS.cross} Uso:\n${usage(process.env.PREFIX || '.')}`));
            }
            const snapshot = await updateSeasonStyle({ mode: 'manual', manualSeason: season }, { id: message.author?.id, tag: message.author?.tag });
            const view = formatSeasonStatus(snapshot);
            return message.reply(buildPanel('Estilo estacional', `${EMOJIS.tick} Modo manual aplicado: **${view.manual}** • Color: **${view.color}**`));
        }

        if (sub === 'hemisferio' || sub === 'hemisphere') {
            const hemisphere = normalizeHemisphereInput(args[1]);
            if (!hemisphere) {
                return message.reply(buildPanel('Estilo estacional', `${EMOJIS.cross} Uso:\n${usage(process.env.PREFIX || '.')}`));
            }
            const snapshot = await updateSeasonStyle({ hemisphere }, { id: message.author?.id, tag: message.author?.tag });
            const view = formatSeasonStatus(snapshot);
            return message.reply(buildPanel('Estilo estacional', `${EMOJIS.tick} Hemisferio actualizado a **${view.hemisphere}**. Estación activa: **${view.active}** • Color: **${view.color}**`));
        }

        if (sub === 'actualizar' || sub === 'refresh') {
            const snapshot = await refreshSeasonStyle();
            const view = formatSeasonStatus(snapshot);
            return message.reply(buildPanel('Estilo estacional', `${EMOJIS.tick} Estilo recalculado. Estación: **${view.active}** • Color: **${view.color}**`));
        }

        return message.reply(buildPanel('Estilo estacional', `${EMOJIS.cross} Uso:\n${usage(process.env.PREFIX || '.')}`));
    },
};
