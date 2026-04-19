
// Evento: mensajes eliminados masivamente
const { messageBulkDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (messages) => {
    try {
        global.__moxiBulkDelete = true;
        setTimeout(() => { global.__moxiBulkDelete = false; }, 3000);
        if (!messages || messages.size === 0) return;
        const firstMsg = messages.first();
        const { guild, channel } = firstMsg;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(messageBulkDeleteEmbed({ channelId: channel.id, count: messages.size, timeStr, guildId: guild.id }))
            .catch(err => auditLogDebug('messageBulkDelete', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('messageBulkDelete', 'error inesperado:', err?.message || err);
    }
};
