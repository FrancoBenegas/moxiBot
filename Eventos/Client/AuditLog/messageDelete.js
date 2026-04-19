
// Evento: mensaje eliminado
const { messageDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const audit = require('../../../Util/audit');
const debugHelper = require('../../../Util/debugHelper');

module.exports = async (message) => {
    try {
        // Si la bandera global de borrado masivo está activa, no enviar log individual
        if (global.__moxiBulkDelete) return;
        debugHelper.log('auditlog', 'Evento messageDelete disparado:', {
            id: message.id,
            author: message.author?.id,
            channel: message.channel?.id,
            guild: message.guild?.id
        });
        if (!message.guild) return;
        const { channelId, enabled } = await audit.resolveAuditConfig(message.guild.id, 'es-ES');
        if (!enabled || !channelId) {
            debugHelper.log('auditlog', 'messageDelete: audit desactivado o sin canal', { enabled, channelId });
            return;
        }
        const ch = message.guild.channels.cache.get(channelId)
            || await message.guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') {
            debugHelper.warn('auditlog', 'messageDelete: canal audit no encontrado', { channelId });
            return;
        }
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        const guildId = message.guild.id;
        const msgChannelId = message.channel?.id || message.channelId;
        const messageUrl = guildId && msgChannelId
            ? `https://discord.com/channels/${guildId}/${msgChannelId}/${message.id}`
            : null;
        const logObj = messageDeleteEmbed({
            messageId: message.id,
            authorId: message.author?.id || message.member?.id || null,
            authorUsername: message.author?.username || message.member?.user?.username || null,
            channelId: msgChannelId,
            channelName: message.channel?.name || null,
            content: message.content || null,
            messageUrl,
            timeStr,
        });
        debugHelper.log('auditlog', 'messageDelete: enviando log');
        await ch.send(logObj).catch((err) => {
            debugHelper.error('auditlog', 'messageDelete: fallo al enviar:', err?.message || err);
        });
    } catch (err) {
        debugHelper.error('auditlog', 'messageDelete: error inesperado:', err?.message || err);
    }
};
