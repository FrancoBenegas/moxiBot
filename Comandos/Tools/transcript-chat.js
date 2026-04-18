const {
    AttachmentBuilder,
    ActionRowBuilder,
    ChannelType,
    ContainerBuilder,
    MessageFlags,
    PermissionsBitField,
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { toolsCategory } = require('../../Util/commandCategories');
const { ButtonBuilder, ButtonStyle } = require('../../Util/compatButtonBuilder');

const MAX_MESSAGES = 2000;
const DEFAULT_FETCH_LIMIT = 500;
const ALLOWED_CHANNEL_TYPES = new Set([
    ChannelType.GuildText,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread,
]);

function resolveChannelId(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';

    const mentionMatch = raw.match(/^<#(\d{17,20})>$/);
    if (mentionMatch) return mentionMatch[1];

    const idMatch = raw.match(/^(\d{17,20})$/);
    return idMatch ? idMatch[1] : '';
}

function sanitizeFileName(value) {
    return String(value || 'transcript-chat')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'transcript-chat';
}

function isAdminMember(member) {
    return Boolean(member?.permissions?.has?.(PermissionsBitField.Flags.Administrator));
}

function formatRangeLabel(rangeMs) {
    if (!Number.isFinite(rangeMs) || rangeMs <= 0) return 'Todo el rango cargado';

    const units = [
        { label: 'sem', value: 7 * 24 * 60 * 60 * 1000 },
        { label: 'd', value: 24 * 60 * 60 * 1000 },
        { label: 'h', value: 60 * 60 * 1000 },
        { label: 'm', value: 60 * 1000 },
    ];

    for (const unit of units) {
        if (rangeMs >= unit.value && rangeMs % unit.value === 0) {
            return `${Math.round(rangeMs / unit.value)}${unit.label}`;
        }
    }

    return `${Math.round(rangeMs / 1000)}s`;
}

function truncateText(value, maxLength = 140) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '[sin contenido]';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
}

function buildSummaryText({ targetChannel, destinationChannel, messages, limit, rangeMs }) {
    const uniqueAuthors = new Set(messages.map((msg) => msg.author?.id).filter(Boolean)).size;
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const previewMessages = messages.slice(-3).map((msg) => {
        const author = msg.author?.tag || msg.author?.username || 'Usuario';
        return `- ${author}: ${truncateText(msg.cleanContent || msg.content || '')}`;
    }).join('\n');

    return [
        `Origen: <#${targetChannel.id}>`,
        `Destino: <#${destinationChannel.id}>`,
        `Mensajes exportados: ${messages.length}/${limit}`,
        `Autores distintos: ${uniqueAuthors}`,
        `Rango solicitado: ${formatRangeLabel(rangeMs)}`,
        `Primer mensaje: <t:${Math.floor(firstMessage.createdTimestamp / 1000)}:f>`,
        `Ultimo mensaje: <t:${Math.floor(lastMessage.createdTimestamp / 1000)}:f>`,
        '',
        'Vista previa:',
        previewMessages || '- Sin vista previa',
    ].join('\n');
}

function buildTranscriptPanel({ requesterId, targetChannelId, destinationChannelId, summaryText, downloadCustomId, sourceMessageUrl }) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.note || EMOJIS.check || 'OK'} Resumen del transcript`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Solicitado por: <@${requesterId}>`))
        .addTextDisplayComponents(c => c.setContent(summaryText));

    const downloadButton = new ButtonBuilder()
        .setCustomId(downloadCustomId)
        .setLabel('Descargar HTML')
        .setStyle(ButtonStyle.Primary);

    const jumpButton = new ButtonBuilder()
        .setLabel('Ir al comando')
        .setStyle(ButtonStyle.Link)
        .setURL(sourceMessageUrl);

    const row = new ActionRowBuilder().addComponents(downloadButton, jumpButton);
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent(`Origen: <#${targetChannelId}>\nDestino: <#${destinationChannelId}>`));
    container.addActionRowComponents(row);

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] },
    };
}

function buildSuccessPanel({ targetChannelId, destinationChannelId, requesterId, panelMessageUrl }) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.check || 'OK'} Transcript chat`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Transcript generado de <#${targetChannelId}>. Panel enviado a <#${destinationChannelId}> para <@${requesterId}>.`));

    const goButton = new ButtonBuilder()
        .setLabel('Ir al panel')
        .setStyle(ButtonStyle.Link)
        .setURL(panelMessageUrl);

    const row = new ActionRowBuilder().addComponents(goButton);
    container.addActionRowComponents(row);

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] },
    };
}

function parseTimeRangeMs(rawValue) {
    const raw = String(rawValue || '').trim().toLowerCase();
    if (!raw) return null;

    const match = raw.match(/^(\d+)\s*(s|m|min|h|d|w|sem|day|days|hora|horas|dia|dias)$/i);
    if (!match) return null;

    const amount = Number.parseInt(match[1], 10);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const unit = match[2].toLowerCase();
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        min: 60 * 1000,
        h: 60 * 60 * 1000,
        hora: 60 * 60 * 1000,
        horas: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        dia: 24 * 60 * 60 * 1000,
        dias: 24 * 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        sem: 7 * 24 * 60 * 60 * 1000,
    };

    const multiplier = multipliers[unit];
    return multiplier ? amount * multiplier : null;
}

async function fetchFilteredMessages(channel, { limit, sinceTimestamp }) {
    const collected = [];
    let before;
    const resolvedLimit = Number.isFinite(limit) && limit > 0
        ? Math.min(limit, MAX_MESSAGES)
        : DEFAULT_FETCH_LIMIT;

    while (collected.length < resolvedLimit) {
        const remaining = resolvedLimit - collected.length;
        const batchSize = Math.min(100, remaining);
        const batch = await channel.messages.fetch({ limit: batchSize, before });
        if (!batch.size) break;

        const sortedBatch = Array.from(batch.values()).sort((left, right) => left.createdTimestamp - right.createdTimestamp);
        const filteredBatch = sinceTimestamp
            ? sortedBatch.filter((msg) => msg.createdTimestamp >= sinceTimestamp)
            : sortedBatch;

        collected.push(...filteredBatch);

        const oldestMessage = sortedBatch[0];
        before = oldestMessage?.id;

        const reachedOlderMessages = sinceTimestamp
            ? sortedBatch.some((msg) => msg.createdTimestamp < sinceTimestamp)
            : false;

        if (!before || batch.size < batchSize || reachedOlderMessages) break;
    }

    return collected.sort((left, right) => left.createdTimestamp - right.createdTimestamp).slice(-resolvedLimit);
}

function parseCommandArgs(args, currentChannelId) {
    const rawArgs = Array.isArray(args) ? args.filter(Boolean) : [];
    const channelIds = [];
    let limit = null;
    let rangeMs = null;

    for (const rawArg of rawArgs) {
        const channelId = resolveChannelId(rawArg);
        if (channelId) {
            channelIds.push(channelId);
            continue;
        }

        const parsedRangeMs = parseTimeRangeMs(rawArg);
        if (Number.isFinite(parsedRangeMs) && parsedRangeMs > 0) {
            rangeMs = parsedRangeMs;
            continue;
        }

        const numericValue = Number.parseInt(rawArg, 10);
        if (Number.isFinite(numericValue)) {
            limit = numericValue;
        }
    }

    let sourceChannelId = currentChannelId || '';
    let destinationChannelId = '';

    if (channelIds.length === 1) {
        if (channelIds[0] !== currentChannelId) {
            sourceChannelId = channelIds[0];
        }
    }

    if (channelIds.length >= 2) {
        sourceChannelId = channelIds[0];
        destinationChannelId = channelIds[1];
    }

    return {
        sourceChannelId,
        destinationChannelId,
        requestedLimit: Number.isFinite(limit) ? limit : DEFAULT_FETCH_LIMIT,
        rangeMs,
    };
}

module.exports = {
    name: 'transcript-chat',
    alias: ['tc', 'transcriptchat', 'transcript', 'trascript-chat', 'trascriptchat'],
    Category: toolsCategory,
    usage: 'tc [id-del-chat] [id-del-canal-destino] [limite] [rango]',
    description: 'Genera un transcript estilo ticket del canal actual o de un canal/hilo, puede enviarlo a otro canal y filtrar por tiempo.',
    cooldown: 5,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const member = message.member;
        if (!isAdminMember(member)) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: 'Necesitas ser administrador para usar este comando.',
                    })
                )
            );
        }

        const replyPerms = message.channel?.permissionsFor?.(Moxi.user?.id || Moxi.user);
        if (!replyPerms?.has(PermissionsBitField.Flags.SendMessages)) {
            return;
        }

        const {
            sourceChannelId,
            destinationChannelId,
            requestedLimit,
            rangeMs,
        } = parseCommandArgs(args, message.channel?.id || '');

        let targetChannel = message.channel;
        if (sourceChannelId && sourceChannelId !== message.channel?.id) {
            try {
                targetChannel = await message.guild.channels.fetch(sourceChannelId);
            } catch {
                targetChannel = null;
            }
        }

        let destinationChannel = message.channel;
        if (destinationChannelId) {
            try {
                destinationChannel = await message.guild.channels.fetch(destinationChannelId);
            } catch {
                destinationChannel = null;
            }
        }

        if (!replyPerms?.has(PermissionsBitField.Flags.AttachFiles) && (!destinationChannelId || destinationChannelId === message.channel?.id)) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: 'No puedo adjuntar archivos en este canal. Dame el permiso Adjuntar archivos e inténtalo otra vez.',
                    })
                )
            );
        }

        if (!targetChannel) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: 'No encontré un canal o hilo con ese ID en este servidor.',
                    })
                )
            );
        }

        if (!destinationChannel) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: 'No encontré el canal destino en este servidor.',
                    })
                )
            );
        }

        if (!ALLOWED_CHANNEL_TYPES.has(targetChannel.type)) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: 'Ese canal no es compatible. Solo puedo generar transcript de canales de texto e hilos. Uso: tc [id-del-chat] [id-del-canal-destino] [limite] [rango].',
                    })
                )
            );
        }

        if (!ALLOWED_CHANNEL_TYPES.has(destinationChannel.type) && destinationChannel.type !== ChannelType.GuildText) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: 'El canal destino debe ser un canal de texto o un hilo.',
                    })
                )
            );
        }

        const targetPerms = targetChannel.permissionsFor?.(Moxi.user?.id || Moxi.user);
        const missingTargetPerms = [];
        if (!targetPerms?.has(PermissionsBitField.Flags.ViewChannel)) missingTargetPerms.push('Ver canal');
        if (!targetPerms?.has(PermissionsBitField.Flags.ReadMessageHistory)) missingTargetPerms.push('Leer historial de mensajes');

        if (missingTargetPerms.length) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: `No puedo leer ese chat. Me faltan estos permisos en <#${targetChannel.id}>: ${missingTargetPerms.join(', ')}.`,
                    })
                )
            );
        }

        const destinationPerms = destinationChannel.permissionsFor?.(Moxi.user?.id || Moxi.user);
        const missingDestinationPerms = [];
        if (!destinationPerms?.has(PermissionsBitField.Flags.ViewChannel)) missingDestinationPerms.push('Ver canal');
        if (!destinationPerms?.has(PermissionsBitField.Flags.SendMessages)) missingDestinationPerms.push('Enviar mensajes');
        if (!destinationPerms?.has(PermissionsBitField.Flags.AttachFiles)) missingDestinationPerms.push('Adjuntar archivos');

        if (missingDestinationPerms.length) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: `No puedo enviar el transcript a <#${destinationChannel.id}>. Me faltan: ${missingDestinationPerms.join(', ')}.`,
                    })
                )
            );
        }

        const progressMessage = await message.reply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.clock || '...',
                    title: 'Transcript chat',
                    text: `Generando transcript de <#${targetChannel.id}>${rangeMs ? ` de los ultimos ${Math.round(rangeMs / (60 * 60 * 1000) * 10) / 10}h aprox.` : ''}...`,
                })
            )
        );

        try {
            const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
                ? Math.min(requestedLimit, MAX_MESSAGES)
                : DEFAULT_FETCH_LIMIT;
            const sinceTimestamp = Number.isFinite(rangeMs) && rangeMs > 0
                ? Date.now() - rangeMs
                : null;
            const messages = await fetchFilteredMessages(targetChannel, { limit, sinceTimestamp });

            if (!messages.length) {
                return progressMessage.edit(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Transcript chat',
                            text: rangeMs
                                ? 'No encontré mensajes en ese rango de tiempo para generar el transcript.'
                                : 'No encontré mensajes para generar el transcript.',
                        })
                    )
                );
            }

            const fileBase = sanitizeFileName(`${message.guild?.name || 'server'}-${targetChannel?.name || 'canal'}`);
            const summaryText = buildSummaryText({
                targetChannel,
                destinationChannel,
                messages,
                limit,
                rangeMs,
            });
            const sourceMessageUrl = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
            const transcriptBuffer = await discordTranscripts.generateFromMessages(
                messages,
                targetChannel,
                {
                    returnType: 'buffer',
                    poweredBy: false,
                    saveImages: false,
                    footerText: 'Exportados {number} mensaje(s)',
                }
            );
            const downloadCustomId = `tc_download_${message.id}_${Date.now()}`;
            const panelMessage = await destinationChannel.send(
                buildTranscriptPanel({
                    requesterId: message.author.id,
                    targetChannelId: targetChannel.id,
                    destinationChannelId: destinationChannel.id,
                    summaryText,
                    downloadCustomId,
                    sourceMessageUrl,
                })
            );
            const panelMessageUrl = `https://discord.com/channels/${message.guild.id}/${destinationChannel.id}/${panelMessage.id}`;

            const collector = panelMessage.createMessageComponentCollector();

            collector.on('collect', async (interaction) => {
                if (interaction.customId !== downloadCustomId) return;

                if (!isAdminMember(interaction.member)) {
                    await interaction.reply({
                        content: 'Solo los administradores pueden usar estos botones.',
                        ephemeral: true,
                        allowedMentions: { parse: [] },
                    }).catch(() => null);
                    return;
                }

                const attachment = new AttachmentBuilder(transcriptBuffer, {
                    name: `${fileBase}.html`,
                    description: `Transcript de ${targetChannel.name || targetChannel.id}`,
                });

                await interaction.reply({
                    content: `Descarga del transcript de <#${targetChannel.id}> solicitada por <@${message.author.id}>.`,
                    files: [attachment],
                    ephemeral: true,
                    allowedMentions: { parse: [] },
                }).catch(() => null);
            });

            await progressMessage.edit(
                buildSuccessPanel({
                    targetChannelId: targetChannel.id,
                    destinationChannelId: destinationChannel.id,
                    requesterId: message.author.id,
                    panelMessageUrl,
                })
            );
        } catch (error) {
            const errorMessage = String(error?.message || 'error desconocido');
            const tooLarge = /request entity too large|payload too large|request body larger than maxbodylength limit/i.test(errorMessage);

            await progressMessage.edit(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Transcript chat',
                        text: tooLarge
                            ? 'No pude generar el transcript porque el archivo resultante es demasiado grande. Prueba con un limite menor o un rango mas corto, por ejemplo `tc 200 2d` o `tc <#canal> 100`.'
                            : `No pude generar el transcript: ${errorMessage}`,
                    })
                )
            ).catch(() => null);
        }
    },
};