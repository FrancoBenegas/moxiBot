const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { buildDisabledMusicSessionContainer } = require('../../Components/V2/musicControlsComponent');
const { formatSessionEndedFooter } = require('../../Util/seasonBrand');
const { getGuildSettingsCached, setGuildMusicPanelConfig } = require('../../Util/guildSettings');

function resolvePanelImageUrl(Moxi) {
    const envUrl = String(process.env.MUSIC_FALLBACK_IMAGE_URL || '').trim();
    if (envUrl) return envUrl;
    return Moxi?.user?.displayAvatarURL?.({ extension: 'png', size: 1024 }) || null;
}

function pickImageUrlFromInput(message, rawValue) {
    const direct = String(rawValue || '').trim();
    if (/^https?:\/\//i.test(direct)) return direct;
    const attachment = message.attachments?.first?.();
    const attachmentUrl = String(attachment?.url || '').trim();
    if (/^https?:\/\//i.test(attachmentUrl)) return attachmentUrl;
    return '';
}

function panelText(title, body) {
    return {
        content: '',
        components: [
            new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(String(body || ''))),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

function parseChannelFromArg(message, raw) {
    const text = String(raw || '').trim();
    if (!text) return message.channel;

    const mention = text.match(/^<#(\d+)>$/);
    const id = mention ? mention[1] : text.replace(/\D/g, '');
    if (!id) return null;
    return message.guild?.channels?.cache?.get(id) || null;
}

async function resolveTargetChannel(message, rawArg) {
    const picked = parseChannelFromArg(message, rawArg);

    // Compatibilidad: si no pasan argumento, usar canal actual.
    if (!picked) {
        return { channel: message.channel, created: false };
    }

    // Si pasan un canal de texto, usarlo tal cual.
    if (picked?.isTextBased?.() && picked.type !== ChannelType.GuildCategory) {
        return { channel: picked, created: false };
    }

    // Si pasan una categoría, crear (o reutilizar) el canal fijo dentro de ella.
    if (picked?.type === ChannelType.GuildCategory) {
        const desiredName = 'moxi-music-panel';
        const existing = message.guild.channels.cache.find((ch) =>
            ch.type === ChannelType.GuildText
            && ch.parentId === picked.id
            && String(ch.name || '').toLowerCase() === desiredName
        );

        if (existing) return { channel: existing, created: false };

        const created = await message.guild.channels.create({
            name: desiredName,
            type: ChannelType.GuildText,
            parent: picked.id,
            reason: `Panel de musica solicitado por ${message.author?.tag || message.author?.id || 'unknown'}`,
        }).catch(() => null);

        if (!created) return { channel: null, created: false };
        return { channel: created, created: true };
    }

    return { channel: null, created: false };
}

async function activateMusicPanelInChannel({ message, targetChannel, created = false, panelImageUrl = '' }) {
    const idleContainer = buildDisabledMusicSessionContainer({
        title: '## Panel de musica fijo',
        info: 'Escribe aqui el nombre de una cancion para reproducirla automaticamente.\nLos comandos de musica tambien funcionan normalmente.',
        imageUrl: panelImageUrl || resolvePanelImageUrl(message.client),
        footerText: formatSessionEndedFooter(),
    });

    const panelMessage = await targetChannel.send({
        content: '',
        components: [idleContainer],
        flags: MessageFlags.IsComponentsV2,
    }).catch(() => null);

    if (!panelMessage) {
        return {
            ok: false,
            reply: panelText('Panel de musica', `${EMOJIS.cross} No pude enviar el panel en ese canal (revisa permisos).`),
        };
    }

    await setGuildMusicPanelConfig(message.guild.id, {
        enabled: true,
        channelId: targetChannel.id,
        messageId: panelMessage.id,
        imageUrl: panelImageUrl || undefined,
        active: false,
        lastActiveAt: new Date(),
    });

    return {
        ok: true,
        reply: panelText(
            'Panel de musica',
            `${EMOJIS.tick} Panel fijo activado en <#${targetChannel.id}>.${created ? '\nCanal creado automaticamente: **moxi-music-panel**.' : ''}\nAhora puedes escribir canciones sin comando y tambien seguir usando comandos de musica.`
        ),
    };
}

async function refreshExistingPanelImage({ message, imageUrl }) {
    const cfg = await getGuildSettingsCached(message.guild.id).catch(() => null);
    const channelId = String(cfg?.MusicFixedPanelChannelId || '');
    const messageId = String(cfg?.MusicFixedPanelMessageId || '');
    if (!channelId || !messageId) return false;

    const channel = message.guild.channels.cache.get(channelId)
        || await message.guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) return false;

    const panelMessage = await channel.messages.fetch(messageId).catch(() => null);
    if (!panelMessage) return false;

    const idleContainer = buildDisabledMusicSessionContainer({
        title: '## Panel de musica fijo',
        info: 'Escribe aqui el nombre de una cancion para reproducirla automaticamente.\nLos comandos de musica tambien funcionan normalmente.',
        imageUrl: imageUrl || resolvePanelImageUrl(message.client),
        footerText: formatSessionEndedFooter(),
    });

    await panelMessage.edit({
        content: '',
        components: [idleContainer],
        flags: MessageFlags.IsComponentsV2,
    }).catch(() => null);

    return true;
}

function buildCategorySelector({ categories, customId }) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder('Selecciona una categoria para crear el panel')
        .addOptions([
            {
                label: 'Usar canal actual',
                description: 'Activar panel en este canal',
                value: 'current_channel',
            },
            ...categories.map((c) => ({
                label: String(c.name || 'categoria').slice(0, 100),
                description: `Crear moxi-music-panel en ${String(c.name || 'categoria').slice(0, 80)}`,
                value: `category:${c.id}`,
            })),
        ]);

    return new ActionRowBuilder().addComponents(menu);
}

async function promptCategorySelector({ Moxi, message }) {
    const categories = message.guild.channels.cache
        .filter((ch) => ch.type === ChannelType.GuildCategory)
        .sort((a, b) => (a.rawPosition ?? a.position ?? 0) - (b.rawPosition ?? b.position ?? 0))
        .first(24);

    const customId = `musicpanel_pick_${message.id}_${Date.now()}`;
    const row = buildCategorySelector({ categories, customId });

    const promptMsg = await message.reply({
        content: 'Selecciona donde crear el panel de musica:',
        components: [row],
        allowedMentions: { repliedUser: false, parse: [] },
    }).catch(() => null);

    if (!promptMsg) {
        return message.reply(panelText('Panel de musica', `${EMOJIS.cross} No pude abrir el selector en este canal.`));
    }

    const collector = promptMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60_000,
        max: 1,
        filter: (i) => i.user?.id === message.author?.id && i.customId === customId,
    });

    collector.on('collect', async (interaction) => {
        const selected = String(interaction.values?.[0] || '');
        let resolved = { channel: null, created: false };

        if (selected === 'current_channel') {
            resolved = { channel: message.channel, created: false };
        } else if (selected.startsWith('category:')) {
            const categoryId = selected.slice('category:'.length);
            resolved = await resolveTargetChannel(message, `<#${categoryId}>`);
        }

        if (!resolved?.channel || !resolved.channel.isTextBased?.()) {
            return interaction.update(panelText('Panel de musica', `${EMOJIS.cross} No pude resolver el destino seleccionado.`));
        }

        const cfg = await getGuildSettingsCached(message.guild.id).catch(() => null);
        const result = await activateMusicPanelInChannel({
            message,
            targetChannel: resolved.channel,
            created: !!resolved.created,
            panelImageUrl: String(cfg?.MusicFixedPanelImageUrl || '').trim(),
        });

        return interaction.update(result.reply);
    });

    collector.on('end', async (_collected, reason) => {
        if (reason === 'limit') return;
        try {
            const disabledRow = buildCategorySelector({ categories, customId });
            disabledRow.components[0].setDisabled(true);
            await promptMsg.edit({
                content: 'Selector cerrado por tiempo.',
                components: [disabledRow],
                allowedMentions: { repliedUser: false, parse: [] },
            }).catch(() => null);
        } catch {
            // ignore
        }
    });
}

module.exports = {
    name: 'musicpanel',
    alias: ['musicpanel', 'panelmusica', 'panelmusic', 'mpanel'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_MUSICA', lang);
    },
    usage: 'musicpanel <status|on|off|image> [#canal|#categoria|url]',
    description: function (lang) {
        return moxi.translate('commands:CMD_PLAY_DESC', lang || 'es-ES');
    },
    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const sub = String(args?.[0] || 'status').trim().toLowerCase();
        const canManage = message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild, true)
            || message.member?.permissions?.has(PermissionsBitField.Flags.ManageChannels, true)
            || message.member?.permissions?.has(PermissionsBitField.Flags.Administrator, true);

        if (!canManage) {
            return message.reply(panelText('Panel de musica', `${EMOJIS.cross} Necesitas permisos de gestion para configurar el panel.`));
        }

        if (sub === 'status') {
            const cfg = await getGuildSettingsCached(message.guild.id);
            const enabled = !!cfg?.MusicFixedPanelEnabled;
            const channelId = cfg?.MusicFixedPanelChannelId || null;
            const messageId = cfg?.MusicFixedPanelMessageId || null;
            const active = !!cfg?.MusicFixedPanelActive;
            const imageUrl = String(cfg?.MusicFixedPanelImageUrl || '').trim();
            const panelLink = (channelId && messageId)
                ? `https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}`
                : '-';

            const body = [
                `Estado: **${enabled ? 'ON' : 'OFF'}**`,
                `Canal: ${channelId ? `<#${channelId}>` : '-'}`,
                `Panel: ${panelLink}`,
                `Activo: **${active ? 'SI' : 'NO'}**`,
                `Imagen principal: ${imageUrl || '(fallback del bot)'}`,
                '',
                `Comandos siguen funcionando: **SI** (.play, /moxi play, botones).`,
            ].join('\n');

            return message.reply(panelText('Panel de musica', body));
        }

        if (sub === 'off') {
            await setGuildMusicPanelConfig(message.guild.id, {
                enabled: false,
                active: false,
                lastActiveAt: new Date(),
            });
            return message.reply(panelText('Panel de musica', `${EMOJIS.tick} Panel fijo desactivado. Los comandos de musica siguen funcionando normalmente.`));
        }

        if (sub === 'image' || sub === 'imagen' || sub === 'img') {
            const imageUrl = pickImageUrlFromInput(message, args?.[1]);
            if (!imageUrl) {
                return message.reply(panelText('Panel de musica', `${EMOJIS.cross} Usa: \`musicpanel image <url>\` o adjunta una imagen junto al comando.`));
            }

            await setGuildMusicPanelConfig(message.guild.id, {
                imageUrl,
                lastActiveAt: new Date(),
            });

            const refreshed = await refreshExistingPanelImage({ message, imageUrl }).catch(() => false);

            return message.reply(panelText('Panel de musica', `${EMOJIS.tick} Imagen principal del panel actualizada correctamente.${refreshed ? '\nEl panel actual fue editado al instante.' : ''}`));
        }

        if (sub === 'on') {
            const hasManageChannels = message.guild?.members?.me?.permissions?.has(PermissionsBitField.Flags.ManageChannels, true);
            if (!hasManageChannels) {
                return message.reply(panelText('Panel de musica', `${EMOJIS.cross} Me falta permiso de Gestionar canales para crear el canal del panel.`));
            }

            // Sin argumentos: abrir selector interactivo.
            if (!args?.[1]) {
                await promptCategorySelector({ Moxi, message });
                return;
            }

            const resolved = await resolveTargetChannel(message, args?.[1]);
            const targetChannel = resolved.channel;
            if (!targetChannel || !targetChannel.isTextBased?.()) {
                return message.reply(panelText('Panel de musica', `${EMOJIS.cross} Indica un canal de texto o una categoria valida.`));
            }

            const cfg = await getGuildSettingsCached(message.guild.id).catch(() => null);

            const result = await activateMusicPanelInChannel({
                message,
                targetChannel,
                created: !!resolved.created,
                panelImageUrl: String(cfg?.MusicFixedPanelImageUrl || '').trim(),
            });
            return message.reply(result.reply);
        }

        return message.reply(panelText('Panel de musica', 'Uso: `musicpanel status`, `musicpanel on [#canal|#categoria]`, `musicpanel image <url|adjunto>`, `musicpanel off`.'));
    },
};
