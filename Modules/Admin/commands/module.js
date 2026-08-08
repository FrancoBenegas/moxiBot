const moxi = require('../../../i18n');
const { Bot } = require('../../../Config');
const { EMOJIS } = require('../../../Util/emojis');
const { setGuildModuleEnabled, getGuildSettingsCached } = require('../../../Util/guildSettings');
const { PermissionsBitField: { Flags }, ContainerBuilder, MessageFlags, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('../../../Util/compatButtonBuilder');
const log = require('../../../Util/logger');

const ALL_MODULES = [
    { id: 'economy',      label: 'Economy',      emoji: '💰' },
    { id: 'fun',          label: 'Fun',          emoji: '🎮' },
    { id: 'games',        label: 'Games',        emoji: '🕹️' },
    { id: 'genshin',      label: 'Genshin',      emoji: '⚔️' },
    { id: 'matrimonio',   label: 'Matrimonio',   emoji: '💍' },
    { id: 'moderation',   label: 'Moderation',   emoji: '🛡️' },
    { id: 'music',        label: 'Music',        emoji: '🎵' },
    { id: 'social',       label: 'Social',       emoji: '👥' },
    { id: 'streaming',    label: 'Streaming',    emoji: '📡' },
    { id: 'systems',      label: 'Systems',      emoji: '🖥️' },
    { id: 'tools',        label: 'Tools',        emoji: '🔧' },
    { id: 'utiility',     label: 'Utility',      emoji: '🛠️' },
    { id: 'verification', label: 'Verification', emoji: '✅' },
    { id: 'voice',        label: 'Voice',        emoji: '🔊' },
];

const PAGE_SIZE = 4;

function buildPanel({ moduleStates, page = 0, botUsername, disableAll = false }) {
    const totalPages = Math.max(1, Math.ceil(ALL_MODULES.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const pageItems = ALL_MODULES.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(
                `📦 **Gestión de Módulos**\n\n`
                + `Activa o desactiva los módulos del servidor con los botones.\n`
                + `🟢 = Activo · 🔴 = Desactivado\n\n`
                + `**Página ${safePage + 1}/${totalPages}**`
            )
        );

    for (const mod of pageItems) {
        const enabled = moduleStates[mod.id] !== false;
        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${mod.emoji} **${mod.label}** \`${mod.id}\``)
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`mod_on_${mod.id}`)
                .setLabel('🟢 Activar')
                .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(disableAll || enabled),
            new ButtonBuilder()
                .setCustomId(`mod_off_${mod.id}`)
                .setLabel('🔴 Desactivar')
                .setStyle(!enabled ? ButtonStyle.Danger : ButtonStyle.Secondary)
                .setDisabled(disableAll || !enabled)
        );
        container.addActionRowComponents(() => row);
    }

    container
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`${EMOJIS.copyright} ${botUsername} • ${new Date().getFullYear()}`)
        );

    if (totalPages > 1) {
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mod_page_prev')
                .setLabel('◀ Anterior')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disableAll || safePage <= 0),
            new ButtonBuilder()
                .setCustomId('mod_page_next')
                .setLabel('Siguiente ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disableAll || safePage >= totalPages - 1)
        );
        container.addActionRowComponents(() => navRow);
    }

    return { container, page: safePage, totalPages };
}

async function getModuleStates(guildId) {
    const settings = await getGuildSettingsCached(guildId).catch(() => null);
    return (settings?.ModuleStates && typeof settings.ModuleStates === 'object')
        ? settings.ModuleStates
        : {};
}

module.exports = {
    name: 'module',
    alias: ['modulo', 'modulos', 'modules', 'module', 'mod-toggle', 'modtoggle', 'mod'],
    description: function () { return 'Activa o desactiva un módulo del servidor.'; },
    usage: 'module',
    Category: function (lang) {
        return moxi.translate('commands:CATEGORY_ADMIN', lang || 'es-ES');
    },
    permissions: { User: [Flags.Administrator] },
    cooldown: 5,

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        let moduleStates = await getModuleStates(guildId);
        let currentPage = 0;

        const panel = buildPanel({ moduleStates, page: currentPage, botUsername: Moxi.user.username });
        currentPage = panel.page;

        const msg = await message.channel.send({
            components: [panel.container],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.customId.startsWith('mod_on_') || i.customId.startsWith('mod_off_') || i.customId.startsWith('mod_page_'),
            time: 5 * 60 * 1000,
        });

        collector.on('collect', async i => {
            try {
                const isAdmin = i.memberPermissions?.has?.(Flags.Administrator, true)
                    || i.member?.permissions?.has?.(Flags.Administrator, true);
                if (!isAdmin) {
                    return i.reply({ content: 'Solo administradores pueden cambiar módulos.', flags: MessageFlags.Ephemeral }).catch(() => null);
                }

                if (i.customId === 'mod_page_prev' || i.customId === 'mod_page_next') {
                    currentPage += i.customId === 'mod_page_prev' ? -1 : 1;
                    moduleStates = await getModuleStates(guildId);
                    const next = buildPanel({ moduleStates, page: currentPage, botUsername: Moxi.user.username });
                    currentPage = next.page;
                    return i.update({ components: [next.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
                }

                const isOn = i.customId.startsWith('mod_on_');
                const prefix = isOn ? 'mod_on_' : 'mod_off_';
                const moduleId = i.customId.slice(prefix.length);
                const newEnabled = isOn;

                const ok = await setGuildModuleEnabled(guildId, moduleId, newEnabled).catch(() => false);
                if (!ok) {
                    return i.reply({ content: '❌ No se pudo guardar el cambio.', flags: MessageFlags.Ephemeral }).catch(() => null);
                }

                moduleStates = await getModuleStates(guildId);
                const updated = buildPanel({ moduleStates, page: currentPage, botUsername: Moxi.user.username });
                currentPage = updated.page;

                await i.update({ components: [updated.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
                await i.followUp({
                    content: `${newEnabled ? '🟢' : '🔴'} Módulo \`${moduleId}\` ${newEnabled ? 'activado' : 'desactivado'}.`,
                    flags: MessageFlags.Ephemeral,
                }).catch(() => null);
            } catch (err) {
                log.error('[module cmd] collector error:', err);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: 'Ocurrió un error.', flags: MessageFlags.Ephemeral }).catch(() => null);
                }
            }
        });

        collector.on('end', async () => {
            try {
                const finalStates = await getModuleStates(guildId);
                const disabled = buildPanel({ moduleStates: finalStates, page: currentPage, botUsername: Moxi.user.username, disableAll: true });
                await msg.edit({ components: [disabled.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
            } catch { }
        });
    },
};
