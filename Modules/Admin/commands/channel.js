
const { PermissionsBitField, ContainerBuilder, StringSelectMenuBuilder, ButtonStyle, MessageFlags, TextInputBuilder, ActionRowBuilder, ModalBuilder } = require('discord.js');
const { ButtonBuilder } = require('../../../Util/compatButtonBuilder');
const { Bot } = require('../../../Config');
const { EMOJIS } = require('../../../Util/emojis');
const moxi = require('../../../i18n');
const { toComponentEmoji } = require('../../../Util/discordEmoji');

module.exports = {
    name: 'channel',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    alias: ['canal', 'channel', 'ch'],
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('audit:CMD_AUDIT_DESC', lang);
    },
    usage: 'channel <crear|borrar|mover|renombrar> <tipo> <nombre> [opciones]',
    async execute(Moxi, message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('No tienes permisos para gestionar canales.');
        }

        // Si hay argumentos, ejecuta el flujo clásico (retrocompatibilidad)
        if (args.length >= 3) {
            // ...existing code...
            return message.reply('Modo clásico deshabilitado, usa el menú interactivo.');
        }

        // COMPONENTS V2: Menú interactivo
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
        container.addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.folder || '📁'} Gestión de canales`));
        container.addSeparatorComponents(s => s.setDivider(true));
        container.addTextDisplayComponents(c => c.setContent('Selecciona la acción y el tipo de canal.'));

        // Select de acción
        const actionSelect = new StringSelectMenuBuilder()
            .setCustomId('channel_action')
            .setPlaceholder(moxi.translate('SELECT_ACTION', lang) || 'Selecciona una acción')
            .addOptions([
                { label: moxi.translate('CREATE', lang) || 'Crear', value: 'crear', emoji: toComponentEmoji(EMOJIS.greenCircle || '🟢') },
                { label: moxi.translate('DELETE', lang) || 'Borrar', value: 'borrar', emoji: toComponentEmoji(EMOJIS.redCircle || '🔴') },
                { label: moxi.translate('RENAME', lang) || 'Renombrar', value: 'renombrar', emoji: toComponentEmoji(EMOJIS.orangeCircle || '🟠') },
                { label: moxi.translate('MOVE', lang) || 'Mover', value: 'mover', emoji: toComponentEmoji(EMOJIS.folder || '📁') },
            ]);

        // Select de tipo
        const typeSelect = new StringSelectMenuBuilder()
            .setCustomId('channel_type')
            .setPlaceholder(moxi.translate('SELECT_CHANNEL_TYPE', lang) || 'Selecciona el tipo de canal')
            .addOptions([
                { label: moxi.translate('TEXT', lang) || 'Texto', value: 'texto', emoji: toComponentEmoji(EMOJIS.book || '📖') },
                { label: moxi.translate('VOICE', lang) || 'Voz', value: 'voz', emoji: toComponentEmoji(EMOJIS.musicNotes || '🎶') },
                { label: moxi.translate('CATEGORY', lang) || 'Categoría', value: 'categoria', emoji: toComponentEmoji(EMOJIS.folder || '📁') },
            ]);

        container.addActionRowComponents(row => row.addComponents(actionSelect));
        container.addActionRowComponents(row => row.addComponents(typeSelect));

        // Botón de continuar
        const continueButton = new ButtonBuilder()
            .setCustomId('channel_continue')
            .setLabel(moxi.translate('CONTINUE', lang) || 'Continuar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(EMOJIS.arrowRight || '➡️');
        const cancelButton = new ButtonBuilder()
            .setCustomId('channel_cancel')
            .setLabel(moxi.translate('CANCEL', lang) || 'Cancelar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.cross || '❌');

        container.addActionRowComponents(row => row.addComponents(continueButton, cancelButton));

        return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};