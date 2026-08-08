const {
    ContainerBuilder,
    MessageFlags,
    PermissionsBitField: { Flags },
    SeparatorBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const moxi = require('../../../i18n');
const { Bot } = require('../../../Config');
const { EMOJIS } = require('../../../Util/emojis');
const {
    getGuildSettingsCached,
    setGuildUpdatesAutoEnabled,
    setGuildUpdatesChannel,
} = require('../../../Util/guildSettings');
const {
    announceUpdateForGuild,
    getReleaseContext,
    buildVersionPanel,
} = require('../../../Util/releaseUpdates');

function buildPanel(title, body) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(String(body || '')));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function parseChannelArg(message, raw) {
    const mention = message.mentions?.channels?.first?.();
    if (mention) return mention;
    const text = String(raw || '').trim();
    if (!text) return null;
    const id = text.replace(/[<#>]/g, '').trim();
    if (!id) return null;
    return message.guild?.channels?.cache?.get(id) || null;
}

function isOn(value) {
    return ['on', 'enable', 'enabled', 'si', 'true', '1'].includes(String(value || '').toLowerCase());
}

function isOff(value) {
    return ['off', 'disable', 'disabled', 'no', 'false', '0'].includes(String(value || '').toLowerCase());
}

module.exports = {
    name: 'updates',
    alias: ['updates', 'update', 'version', 'changelog', 'novedades'],
    usage: 'updates | updates status | updates set #canal | updates auto on|off | updates publish',
    Category: function category(lang) {
        return moxi.translate('commands:CATEGORY_ADMIN', lang || 'es-ES');
    },
    description: 'Muestra version actual y gestiona anuncios de updates por canal.',
    cooldown: 10,
    permissions: {
        User: [],
    },

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const sub = String(args?.[0] || 'show').toLowerCase();

        if (!guildId) {
            return message.reply(buildPanel('Updates', `${EMOJIS.cross} Este comando solo funciona en servidores.`));
        }

        if (sub === 'set') {
            const isAdmin = message.member?.permissions?.has?.(Flags.Administrator, true);
            if (!isAdmin) {
                return message.reply(buildPanel('Updates', `${EMOJIS.cross} Solo administradores pueden configurar el canal de updates.`));
            }

            const ch = parseChannelArg(message, args?.[1]);
            if (!ch || !ch.isTextBased?.()) {
                return message.reply(buildPanel('Updates', `${EMOJIS.cross} Uso: \`updates set #canal\``));
            }

            await setGuildUpdatesChannel(guildId, ch.id);
            return message.reply(buildPanel('Updates', `${EMOJIS.tick} Canal de updates configurado en <#${ch.id}>.`));
        }

        if (sub === 'auto') {
            const isAdmin = message.member?.permissions?.has?.(Flags.Administrator, true);
            if (!isAdmin) {
                return message.reply(buildPanel('Updates', `${EMOJIS.cross} Solo administradores pueden cambiar el modo auto.`));
            }

            const mode = String(args?.[1] || '').toLowerCase();
            if (!isOn(mode) && !isOff(mode)) {
                return message.reply(buildPanel('Updates', `${EMOJIS.cross} Uso: \`updates auto on\` o \`updates auto off\``));
            }

            const enabled = isOn(mode);
            await setGuildUpdatesAutoEnabled(guildId, enabled);
            return message.reply(buildPanel('Updates', `${EMOJIS.tick} Auto-updates ${enabled ? '**activado**' : '**desactivado**'}.`));
        }

        if (sub === 'publish') {
            const isAdmin = message.member?.permissions?.has?.(Flags.Administrator, true);
            if (!isAdmin) {
                return message.reply(buildPanel('Updates', `${EMOJIS.cross} Solo administradores pueden publicar updates manualmente.`));
            }

            const result = await announceUpdateForGuild(Moxi, message.guild, { force: true }).catch(() => ({ ok: false, reason: 'error' }));
            if (!result?.ok) {
                const reason = String(result?.reason || 'error');
                if (reason === 'no-channel') {
                    return message.reply(buildPanel('Updates', `${EMOJIS.cross} Configura primero un canal: \`updates set #canal\`.`));
                }
                return message.reply(buildPanel('Updates', `${EMOJIS.cross} No se pudo publicar update (${reason}).`));
            }
            return message.reply(buildPanel('Updates', `${EMOJIS.tick} Update publicado en el canal configurado (v${result.version}).`));
        }

        if (sub === 'status') {
            const settings = await getGuildSettingsCached(guildId).catch(() => ({}));
            const channelId = String(settings?.UpdateChannelId || '').trim();
            const autoEnabled = Boolean(settings?.UpdateAutoEnabled);
            const lastVersion = String(settings?.UpdateLastAnnouncedVersion || 'N/A');
            const lastCommit = String(settings?.UpdateLastAnnouncedCommit || 'N/A');
            const ctx = getReleaseContext({
                lastAnnouncedVersion: String(settings?.UpdateLastAnnouncedVersion || ''),
                lastAnnouncedCommit: String(settings?.UpdateLastAnnouncedCommit || ''),
            });

            const body = [
                `${EMOJIS.info || 'i'} Version actual: **v${ctx.currentVersion}**`,
                `${EMOJIS.channel || '#'} Canal updates: ${channelId ? `<#${channelId}>` : 'No configurado'}`,
                `${EMOJIS.tick || 'ok'} Auto-updates: **${autoEnabled ? 'ON' : 'OFF'}**`,
                `${EMOJIS.book || 'b'} Ultima version anunciada: **${lastVersion}**`,
                `${EMOJIS.book || 'b'} Ultimo commit anunciado: **${lastCommit === 'N/A' ? 'N/A' : lastCommit.slice(0, 10)}**`,
                `${EMOJIS.info || 'i'} Commits nuevos pendientes: **${ctx.pendingCommitSubjects.length}**`,
                `${EMOJIS.warning || '!'} Variacion detectada (analisis IA): **${ctx.magnitude.label}**`,
            ].join('\n');

            return message.reply(buildPanel('Updates Status', body));
        }

        const settings = await getGuildSettingsCached(guildId).catch(() => ({}));
        const versionPanel = await buildVersionPanel({
            guildName: message.guild?.name || '',
            lastAnnouncedVersion: String(settings?.UpdateLastAnnouncedVersion || ''),
            lastAnnouncedCommit: String(settings?.UpdateLastAnnouncedCommit || ''),
        });
        return message.reply(versionPanel);
    },
};
