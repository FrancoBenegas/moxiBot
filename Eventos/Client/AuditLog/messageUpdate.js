// Evento: mensaje editado
const { messageUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const audit = require('../../../Util/audit');
const debugHelper = require('../../../Util/debugHelper');

module.exports = async (oldMessage, newMessage) => {
    try {
        // Ignorar bots y mensajes sin guild
        if (!newMessage.guild) return;
        if (newMessage.author?.bot) return;

        // Si el contenido no cambió (ej. solo se editó un embed externo) no logear
        if (oldMessage.content === newMessage.content) return;

        debugHelper.log('auditlog', 'Evento messageUpdate disparado:', {
            id: newMessage.id,
            author: newMessage.author?.id,
            channel: newMessage.channel?.id,
            guild: newMessage.guild?.id,
        });

        const { channelId, enabled } = await audit.resolveAuditConfig(newMessage.guild.id, 'es-ES');
        if (!enabled || !channelId) {
            debugHelper.log('auditlog', 'messageUpdate: audit desactivado o sin canal', { enabled, channelId });
            return;
        }

        const ch = newMessage.guild.channels.cache.get(channelId)
            || await newMessage.guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') {
            debugHelper.warn('auditlog', 'messageUpdate: canal audit no encontrado', { channelId });
            return;
        }

        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        const guildId = newMessage.guild.id;
        const msgChannelId = newMessage.channel?.id || newMessage.channelId;
        const messageUrl = guildId && msgChannelId
            ? `https://discord.com/channels/${guildId}/${msgChannelId}/${newMessage.id}`
            : null;

        const logObj = messageUpdateEmbed({
            authorId: newMessage.author?.id || newMessage.member?.id || null,
            authorUsername: newMessage.author?.username || newMessage.member?.user?.username || null,
            channelId: msgChannelId,
            channelName: newMessage.channel?.name || null,
            oldContent: oldMessage.content || null,
            newContent: newMessage.content || null,
            messageUrl,
            timeStr,
        });

        debugHelper.log('auditlog', 'messageUpdate: enviando log');
        await ch.send(logObj).catch((err) => {
            debugHelper.error('auditlog', 'messageUpdate: fallo al enviar:', err?.message || err);
        });
    } catch (err) {
        debugHelper.error('auditlog', 'messageUpdate: error inesperado:', err?.message || err);
    }
};
