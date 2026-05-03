const { MessageFlags, ChannelType } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');

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
} = require('../../Util/collabCore');
const Collab = require('../../Models/CollabSchema');
const { normalizeDiscordId, normalizeDbText } = require('../../Util/idGuards');

function textPanel(title, body) {
    return {
        content: `**${title}**\n${body}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    };
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
    data: new SlashCommandBuilder()
        .setName('colab')
        .setDescription('Sistema de colaboraciones del servidor')
        .setDMPermission(false)
        .addSubcommand((sub) =>
            sub.setName('estado')
                .setDescription('Ver estado del sistema de colaboraciones')
        )
        .addSubcommand((sub) =>
            sub.setName('crear')
                .setDescription('Crear una solicitud de colaboración')
                .addStringOption((opt) => opt.setName('categoria').setDescription('Categoría').setRequired(true)
                    .addChoices(
                        { name: 'Diseño', value: 'design' },
                        { name: 'Código', value: 'code' },
                        { name: 'Música', value: 'music' },
                        { name: 'Video', value: 'video' },
                        { name: 'Social Media', value: 'social' },
                        { name: 'Evento', value: 'event' },
                        { name: 'Otro', value: 'other' }
                    ))
                .addStringOption((opt) => opt.setName('titulo').setDescription('Título corto').setRequired(true).setMaxLength(120))
                .addStringOption((opt) => opt.setName('descripcion').setDescription('Descripción').setRequired(true).setMaxLength(1600))
        )
        .addSubcommand((sub) =>
            sub.setName('listar')
                .setDescription('Listar colaboraciones')
                .addStringOption((opt) => opt.setName('estado').setDescription('Filtrar por estado').setRequired(false)
                    .addChoices(
                        { name: 'Pendiente', value: 'pending' },
                        { name: 'Aprobada', value: 'approved' },
                        { name: 'Denegada', value: 'denied' },
                        { name: 'Cancelada', value: 'cancelled' },
                        { name: 'Completada', value: 'completed' }
                    ))
        )
        .addSubcommand((sub) =>
            sub.setName('aceptar')
                .setDescription('Aceptar una colaboración (staff)')
                .addStringOption((opt) => opt.setName('id').setDescription('ID de la colaboración').setRequired(true))
                .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo opcional').setRequired(false).setMaxLength(500))
        )
        .addSubcommand((sub) =>
            sub.setName('denegar')
                .setDescription('Denegar una colaboración (staff)')
                .addStringOption((opt) => opt.setName('id').setDescription('ID de la colaboración').setRequired(true))
                .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo opcional').setRequired(false).setMaxLength(500))
        )
        .addSubcommand((sub) =>
            sub.setName('cancelar')
                .setDescription('Cancelar una colaboración propia')
                .addStringOption((opt) => opt.setName('id').setDescription('ID de la colaboración').setRequired(true))
                .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo opcional').setRequired(false).setMaxLength(500))
        )
        .addSubcommand((sub) =>
            sub.setName('setcanal')
                .setDescription('Configurar canal de colaboraciones (staff/admin)')
                .addChannelOption((opt) => opt.setName('canal').setDescription('Canal destino').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName('staffrol')
                .setDescription('Configurar rol staff de colaboraciones (staff/admin)')
                .addRoleOption((opt) => opt.setName('rol').setDescription('Rol staff').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName('on')
                .setDescription('Activar sistema de colaboraciones (staff/admin)')
        )
        .addSubcommand((sub) =>
            sub.setName('off')
                .setDescription('Desactivar sistema de colaboraciones (staff/admin)')
        ),

    async run(Moxi, interaction) {
        const guild = interaction.guild;
        const guildId = normalizeDiscordId(interaction.guildId || guild?.id);
        if (!guild || !guildId) {
            return interaction.reply(textPanel('Colaboraciones', 'Este comando solo funciona dentro de un servidor.'));
        }

        const sub = interaction.options.getSubcommand();
        const cfg = await getConfig(guildId);
        const member = interaction.member;

        if (sub === 'estado') {
            const current = await getConfig(guildId);
            const pending = await Collab.countDocuments({ guildID: guildId, type: 'request', status: 'pending' }).catch(() => 0);
            const approved = await Collab.countDocuments({ guildID: guildId, type: 'request', status: 'approved' }).catch(() => 0);
            const denied = await Collab.countDocuments({ guildID: guildId, type: 'request', status: 'denied' }).catch(() => 0);
            return interaction.reply(textPanel(
                'Colaboraciones',
                `Estado: **${current?.enabled ? 'ON' : 'OFF'}**\nCanal: ${current?.channelID ? `<#${current.channelID}>` : '-'}\nRol staff: ${current?.staffRoleID ? `<@&${current.staffRoleID}>` : '-'}\n\nPendientes: **${pending}**\nAprobadas: **${approved}**\nDenegadas: **${denied}**`
            ));
        }

        if (sub === 'setcanal') {
            if (!isStaffMember(member, cfg || {})) {
                return interaction.reply(textPanel('Colaboraciones', 'Solo staff/admin puede configurar el sistema.'));
            }
            const ch = interaction.options.getChannel('canal', true);
            if (!isTextChannel(ch)) {
                return interaction.reply(textPanel('Colaboraciones', 'Selecciona un canal de texto o hilo válido.'));
            }
            await upsertConfig(guildId, guild.name, { enabled: true, channelID: ch.id });
            return interaction.reply(textPanel('Colaboraciones', `Canal configurado: <#${ch.id}>`));
        }

        if (sub === 'staffrol') {
            if (!isStaffMember(member, cfg || {})) {
                return interaction.reply(textPanel('Colaboraciones', 'Solo staff/admin puede configurar el sistema.'));
            }
            const role = interaction.options.getRole('rol', true);
            await upsertConfig(guildId, guild.name, { staffRoleID: role.id });
            return interaction.reply(textPanel('Colaboraciones', `Rol staff configurado: <@&${role.id}>`));
        }

        if (sub === 'on') {
            if (!isStaffMember(member, cfg || {})) {
                return interaction.reply(textPanel('Colaboraciones', 'Solo staff/admin puede activar el sistema.'));
            }
            await upsertConfig(guildId, guild.name, { enabled: true });
            return interaction.reply(textPanel('Colaboraciones', 'Sistema de colaboraciones activado.'));
        }

        if (sub === 'off') {
            if (!isStaffMember(member, cfg || {})) {
                return interaction.reply(textPanel('Colaboraciones', 'Solo staff/admin puede desactivar el sistema.'));
            }
            await upsertConfig(guildId, guild.name, { enabled: false });
            return interaction.reply(textPanel('Colaboraciones', 'Sistema de colaboraciones desactivado.'));
        }

        if (sub === 'listar') {
            const status = normalizeStatus(interaction.options.getString('estado', false) || '');
            const docs = await listRequests(guildId, { status, limit: 15 });
            if (!docs.length) return interaction.reply(textPanel('Colaboraciones', 'No hay colaboraciones para mostrar.'));
            const lines = docs.map(d => `${d.requestId} • ${statusLabel(d.status)} • ${categoryLabel(d.category)} • ${d.title || '-'} • <@${d.authorID}>`);
            return interaction.reply(textPanel('Colaboraciones', lines.join('\n')));
        }

        if (sub === 'crear') {
            const current = cfg || await getConfig(guildId);
            if (!current?.enabled || !current?.channelID) {
                return interaction.reply(textPanel('Colaboraciones', 'El sistema no está configurado. Usa /colab setcanal #canal.'));
            }

            const category = interaction.options.getString('categoria', true);
            const title = interaction.options.getString('titulo', true);
            const description = interaction.options.getString('descripcion', true);

            const doc = await createRequest({
                guildId,
                guildName: guild.name,
                authorId: interaction.user.id,
                authorTag: interaction.user.tag,
                category,
                title,
                description,
            });

            if (!doc) {
                return interaction.reply(textPanel('Colaboraciones', 'No pude crear la solicitud de colaboración.'));
            }

            const channel = guild.channels.cache.get(String(current.channelID)) || await guild.channels.fetch(String(current.channelID)).catch(() => null);
            if (!isTextChannel(channel)) {
                return interaction.reply(textPanel('Colaboraciones', `No puedo acceder al canal configurado (<#${current.channelID}>).`));
            }

            const card = buildCollabCard({ doc, botName: Moxi.user.username });
            const sent = await channel.send({ content: '', components: [card], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => null);
            if (sent) await saveRequestMessageMeta(doc, sent);

            return interaction.reply(textPanel('Colaboraciones', `Solicitud creada con ID **#${doc.requestId}** en <#${channel.id}>.`));
        }

        if (sub === 'aceptar' || sub === 'denegar') {
            if (!isStaffMember(member, cfg || {})) {
                return interaction.reply(textPanel('Colaboraciones', 'Solo staff/admin puede aprobar o denegar colaboraciones.'));
            }
            const id = interaction.options.getString('id', true);
            const reason = normalizeDbText(interaction.options.getString('motivo', false), { maxLen: 500, fallback: '' }) || null;
            const doc = await findRequest(guildId, id);
            if (!doc) return interaction.reply(textPanel('Colaboraciones', 'No encontré esa colaboración.'));
            if (doc.status !== 'pending') {
                return interaction.reply(textPanel('Colaboraciones', `Solo puedes gestionar colaboraciones pendientes. Estado actual: ${statusLabel(doc.status)}.`));
            }

            doc.status = sub === 'aceptar' ? 'approved' : 'denied';
            doc.reviewerID = normalizeDiscordId(interaction.user.id) || null;
            doc.reviewerTag = normalizeDbText(interaction.user.tag, { maxLen: 80, fallback: '' }) || null;
            doc.reason = reason;
            doc.updatedAt = new Date();
            await doc.save().catch(() => null);
            await refreshRequestMessage(guild, doc, Moxi.user.username);

            return interaction.reply(textPanel('Colaboraciones', `Colaboración **#${doc.requestId}** ${sub === 'aceptar' ? 'aceptada' : 'denegada'}.`));
        }

        if (sub === 'cancelar') {
            const id = interaction.options.getString('id', true);
            const reason = normalizeDbText(interaction.options.getString('motivo', false), { maxLen: 500, fallback: '' }) || null;
            const doc = await findRequest(guildId, id);
            if (!doc) return interaction.reply(textPanel('Colaboraciones', 'No encontré esa colaboración.'));
            const isAuthor = String(doc.authorID || '') === String(interaction.user.id || '');
            const canForce = isStaffMember(member, cfg || {});
            if (!isAuthor && !canForce) {
                return interaction.reply(textPanel('Colaboraciones', 'Solo el autor (o staff) puede cancelar esta colaboración.'));
            }
            if (doc.status !== 'pending' && !canForce) {
                return interaction.reply(textPanel('Colaboraciones', 'Solo puedes cancelar colaboraciones pendientes.'));
            }

            doc.status = 'cancelled';
            doc.reviewerID = normalizeDiscordId(interaction.user.id) || null;
            doc.reviewerTag = normalizeDbText(interaction.user.tag, { maxLen: 80, fallback: '' }) || null;
            doc.reason = reason;
            doc.updatedAt = new Date();
            await doc.save().catch(() => null);
            await refreshRequestMessage(guild, doc, Moxi.user.username);
            return interaction.reply(textPanel('Colaboraciones', `Colaboración **#${doc.requestId}** cancelada.`));
        }

        return interaction.reply(textPanel('Colaboraciones', 'Subcomando no reconocido.'));
    },
};
