const { ContainerBuilder, MessageFlags } = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');

function isUntranslated(key, value) {
    if (value === undefined || value === null) return true;
    const out = String(value || '').trim();
    if (!out) return true;
    if (out === key) return true;
    const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
    if (out === withoutNs) return true;
    return false;
}

module.exports = {
    name: 'blacklistguide',
    alias: ['blguide', 'guia-blacklist', 'blacklist-help', 'blacklistguia'],
    usage: 'blacklistguide',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang),
    helpCategories: ['Admin', 'Root'],
    description: (lang = 'es-ES') => {
        const key = 'misc:BLACKLIST_GUIDE_DESC';
        const out = moxi.translate(key, lang);
        return isUntranslated(key, out)
            ? 'Guía rápida para usar blacklist local (admin) y global (owner).'
            : out;
    },
    cooldown: 5,

    async execute(Moxi, message) {
        const guildId = message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0]) ? Bot.Prefix[0] : (process.env.PREFIX || '.');
        const prefix = await moxi.guildPrefix(guildId, globalPrefix);

        const titleKey = 'misc:BLACKLIST_GUIDE_TITLE';
        const title = moxi.translate(titleKey, lang);
        const safeTitle = isUntranslated(titleKey, title) ? 'Guía de Blacklist' : title;

        const localTitle = '🛡️ Local (Admin del servidor)';
        const globalTitle = '👑 Global (Owner del bot)';
        const bt = '`';

        const localLines = [
            `• ${bt}${prefix}blacklist add @usuario [motivo]${bt}`,
            `• ${bt}${prefix}blacklist remove @usuario${bt}`,
            `• ${bt}${prefix}blacklist check @usuario${bt}`,
            `• ${bt}${prefix}blacklist list${bt}`,
        ];

        const globalLines = [
            `• ${bt}${prefix}gblacklist add @usuario [motivo]${bt}`,
            `• ${bt}${prefix}gblacklist remove @usuario${bt}`,
            `• ${bt}${prefix}gblacklist check @usuario${bt}`,
            `• ${bt}${prefix}gblacklist list${bt}`,
        ];

        const notes = [
            'Notas:',
            '• Local bloquea comandos solo en este servidor.',
            '• Global bloquea comandos en todos los servidores del bot.',
            '• El comando global solo lo puede usar el owner real del bot.',
        ];

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent(`# ${safeTitle}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`${localTitle}\n${localLines.join('\n')}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`${globalTitle}\n${globalLines.join('\n')}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(notes.join('\n')))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright || '©️'} ${Moxi.user.username} • ${new Date().getFullYear()}`));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
