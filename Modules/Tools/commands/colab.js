const { ChannelType, ContainerBuilder, MessageFlags } = require('discord.js');

const { Bot } = require('../../../Config');
const moxi = require('../../../i18n');
const { EMOJIS } = require('../../../Util/emojis');
const { normalizeDiscordId, normalizeDbText } = require('../../../Util/idGuards');
const Collab = require('../../../Models/CollabSchema');
const {
    normalizeStatus,
    categoryLabel,
    statusLabel,
    isStaffMember,
    buildCollabCard,
    getConfig,
    upsertConfig,
    createRequest,
    findRequest,
    listRequests,
    saveRequestMessageMeta,
    refreshRequestMessage,
} = require('../../../Util/collabCore');

function panel(title, body, client) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${client.user.username} • ${new Date().getFullYear()}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } };
}

function usage(prefix = '.') {
    return [
        `${prefix}colab crear <categoria> | <titulo> | <descripcion>`,
        `${prefix}colab listar [estado]`,
        `${prefix}colab aceptar <id> [motivo]`,
        `${prefix}colab denegar <id> [motivo]`,
        `${prefix}colab cancelar <id> [motivo]`,
        `${prefix}colab estado`,
        `${prefix}colab set #canal`,
        `${prefix}colab staff @rol`,
        `${prefix}colab on`,
        `${prefix}colab off`,
    ].join('\n');
}

function parseCreateInput(args) {
    const text = args.join(' ').trim();
    const chunks = text.split('|').map(v => String(v || '').trim()).filter(Boolean);
    if (chunks.length < 3) return null;
    const [category, title, ...rest] = chunks;
    const description = rest.join(' | ').trim();
    if (!category || !title || !description) return null;
    return { category, title, description };
}

function isTextChannel(ch) {
    if (!ch) return false;
    if (ch.isTextBased?.()) return true;
    return [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread,
    ].includes(ch.type);
}

module.exports = {
    name: 'colab',
    alias: ['colaboracion', 'colaboración', 'collab'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang),
    usage: 'colab crear <categoria> | <titulo> | <descripcion> | colab listar [estado] | colab aceptar <id> [motivo] | colab denegar <id> [motivo] | colab cancelar <id> [motivo] | colab estado | colab set #canal | colab staff @rol | colab on/off',
    description: () => 'Sistema de colaboraciones del servidor.',
    cooldown: 5,

    async execute(Moxi, message, args) {
        if (!message.guild) return;
        const guildId = normalizeDiscordId(message.guild.id);
        if (!guildId) return;

        const sub = String(args[0] || 'estado').trim().toLowerCase();
        const rest = args.slice(1);
        const cfg = await getConfig(guildId);

        // Config admin
        if (['set', 'canal', 'config', 'setup'].includes(sub)) {
            if (!isStaffMember(message.member, cfg || {})) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo staff/admin puede configurar el sistema.`, Moxi));
            }
            const mentioned = message.mentions?.channels?.first?.();
            const raw = rest[0];
            const id = mentioned?.id || (raw ? String(raw).replace(/[<#>]/g, '') : '');
            const ch = id ? (message.guild.channels.cache.get(id) || await message.guild.channels.fetch(id).catch(() => null)) : null;
            if (!isTextChannel(ch)) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Uso: colab set #canal`, Moxi));
            }

            await upsertConfig(guildId, message.guild.name, { enabled: true, channelID: ch.id });
            return message.reply(panel('Colaboraciones', `${EMOJIS.tick} Canal de colaboraciones configurado: <#${ch.id}>`, Moxi));
        }

        if (['staff', 'rol'].includes(sub)) {
            if (!isStaffMember(message.member, cfg || {})) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo staff/admin puede configurar el sistema.`, Moxi));
            }
            const role = message.mentions?.roles?.first?.();
            const roleId = normalizeDiscordId(role?.id || rest[0]);
            const resolvedRole = roleId ? (message.guild.roles.cache.get(roleId) || await message.guild.roles.fetch(roleId).catch(() => null)) : null;
            if (!resolvedRole) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Uso: colab staff @rol`, Moxi));
            }

            await upsertConfig(guildId, message.guild.name, { staffRoleID: resolvedRole.id });
            return message.reply(panel('Colaboraciones', `${EMOJIS.tick} Rol staff configurado: <@&${resolvedRole.id}>`, Moxi));
        }

        if (sub === 'on') {
            if (!isStaffMember(message.member, cfg || {})) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo staff/admin puede activar el sistema.`, Moxi));
            }
            await upsertConfig(guildId, message.guild.name, { enabled: true });
            return message.reply(panel('Colaboraciones', `${EMOJIS.tick} Sistema de colaboraciones activado.`, Moxi));
        }

        if (sub === 'off') {
            if (!isStaffMember(message.member, cfg || {})) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo staff/admin puede desactivar el sistema.`, Moxi));
            }
            await upsertConfig(guildId, message.guild.name, { enabled: false });
            return message.reply(panel('Colaboraciones', `${EMOJIS.tick} Sistema de colaboraciones desactivado.`, Moxi));
        }

        if (['estado', 'status'].includes(sub)) {
            const current = await getConfig(guildId);
            const pending = await Collab.countDocuments({ guildID: guildId, type: 'request', status: 'pending' }).catch(() => 0);
            const approved = await Collab.countDocuments({ guildID: guildId, type: 'request', status: 'approved' }).catch(() => 0);
            const denied = await Collab.countDocuments({ guildID: guildId, type: 'request', status: 'denied' }).catch(() => 0);
            return message.reply(panel(
                'Colaboraciones',
                `${EMOJIS.info || ''} Estado: **${current?.enabled ? 'ON' : 'OFF'}**\n` +
                `${EMOJIS.channel || ''} Canal: ${current?.channelID ? `<#${current.channelID}>` : '-'}\n` +
                `${EMOJIS.person || ''} Rol staff: ${current?.staffRoleID ? `<@&${current.staffRoleID}>` : '-'}\n\n` +
                `Pendientes: **${pending}**\nAprobadas: **${approved}**\nDenegadas: **${denied}**`,
                Moxi
            ));
        }

        if (['listar', 'list'].includes(sub)) {
            const status = normalizeStatus(rest[0]);
            const docs = await listRequests(guildId, { status, limit: 15 });
            if (!docs.length) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.info || ''} No hay colaboraciones para mostrar.`, Moxi));
            }

            const lines = docs.map(d => `${d.requestId} • ${statusLabel(d.status)} • ${categoryLabel(d.category)} • ${d.title || '-'} • <@${d.authorID}>`);
            return message.reply(panel('Colaboraciones', lines.join('\n'), Moxi));
        }

        if (['aceptar', 'accept', 'aprobar', 'approve', 'denegar', 'deny', 'rechazar'].includes(sub)) {
            const approve = ['aceptar', 'accept', 'aprobar', 'approve'].includes(sub);
            if (!isStaffMember(message.member, cfg || {})) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo staff/admin puede aprobar o denegar colaboraciones.`, Moxi));
            }
            const id = rest[0];
            if (!id) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Uso: colab ${approve ? 'aceptar' : 'denegar'} <id> [motivo]`, Moxi));
            }
            const reason = normalizeDbText(rest.slice(1).join(' '), { maxLen: 500, fallback: '' }) || null;
            const doc = await findRequest(guildId, id);
            if (!doc) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} No encontré esa colaboración.`, Moxi));
            }
            if (doc.status !== 'pending') {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo puedes gestionar colaboraciones pendientes. Estado actual: ${statusLabel(doc.status)}.`, Moxi));
            }

            doc.status = approve ? 'approved' : 'denied';
            doc.reviewerID = normalizeDiscordId(message.author.id) || null;
            doc.reviewerTag = normalizeDbText(message.author.tag, { maxLen: 80, fallback: '' }) || null;
            doc.reason = reason;
            doc.updatedAt = new Date();
            await doc.save().catch(() => null);
            await refreshRequestMessage(message.guild, doc, Moxi.user.username);

            return message.reply(panel('Colaboraciones', `${approve ? '✅' : '❌'} Colaboración **#${doc.requestId}** ${approve ? 'aceptada' : 'denegada'}.`, Moxi));
        }

        if (['cancelar', 'cancel'].includes(sub)) {
            const id = rest[0];
            if (!id) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Uso: colab cancelar <id> [motivo]`, Moxi));
            }
            const reason = normalizeDbText(rest.slice(1).join(' '), { maxLen: 500, fallback: '' }) || null;
            const doc = await findRequest(guildId, id);
            if (!doc) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} No encontré esa colaboración.`, Moxi));
            }
            const isAuthor = String(doc.authorID || '') === String(message.author.id || '');
            const canForce = isStaffMember(message.member, cfg || {});
            if (!isAuthor && !canForce) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo el autor (o staff) puede cancelar esta colaboración.`, Moxi));
            }
            if (doc.status !== 'pending' && !canForce) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Solo puedes cancelar colaboraciones pendientes.`, Moxi));
            }

            doc.status = 'cancelled';
            doc.reviewerID = normalizeDiscordId(message.author.id) || null;
            doc.reviewerTag = normalizeDbText(message.author.tag, { maxLen: 80, fallback: '' }) || null;
            doc.reason = reason;
            doc.updatedAt = new Date();
            await doc.save().catch(() => null);
            await refreshRequestMessage(message.guild, doc, Moxi.user.username);

            return message.reply(panel('Colaboraciones', `🛑 Colaboración **#${doc.requestId}** cancelada.`, Moxi));
        }

        if (['crear', 'solicitar', 'new', 'create'].includes(sub)) {
            const current = cfg || await getConfig(guildId);
            if (!current?.enabled || !current?.channelID) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} El sistema no está configurado. Usa: colab set #canal`, Moxi));
            }

            const parsed = parseCreateInput(rest);
            if (!parsed) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} Uso:\n${usage(process.env.PREFIX || '.')}`, Moxi));
            }

            const doc = await createRequest({
                guildId,
                guildName: message.guild.name,
                authorId: message.author.id,
                authorTag: message.author.tag,
                category: parsed.category,
                title: parsed.title,
                description: parsed.description,
            });

            if (!doc) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} No pude crear la solicitud de colaboración.`, Moxi));
            }

            const ch = message.guild.channels.cache.get(String(current.channelID)) || await message.guild.channels.fetch(String(current.channelID)).catch(() => null);
            if (!isTextChannel(ch)) {
                return message.reply(panel('Colaboraciones', `${EMOJIS.cross} No puedo acceder al canal configurado (<#${current.channelID}>).`, Moxi));
            }

            const card = buildCollabCard({ doc, botName: Moxi.user.username });
            const sent = await ch.send({ content: '', components: [card], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => null);
            if (sent) await saveRequestMessageMeta(doc, sent);

            return message.reply(panel('Colaboraciones', `${EMOJIS.tick} Solicitud creada con ID **#${doc.requestId}** en <#${ch.id}>.`, Moxi));
        }

        return message.reply(panel('Colaboraciones', `${EMOJIS.info || ''} Uso:\n${usage(process.env.PREFIX || '.')}`, Moxi));
    },
};
