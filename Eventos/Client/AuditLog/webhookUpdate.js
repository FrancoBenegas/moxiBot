// Evento: webhook actualizado
const { webhookUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (oldWebhook, newWebhook) => {
    try {
        const { guild, name: oldName, id, channelId: oldChannelId } = oldWebhook;
        const { name: newName, channelId: newChannelId } = newWebhook;
        if (!guild) return;
        const { channelId: auditChannelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !auditChannelId) return;
        const ch = guild.channels.cache.get(auditChannelId)
            || await guild.channels.fetch(auditChannelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(webhookUpdateEmbed({ oldName, newName, id, oldChannelId, newChannelId, timeStr, guildId: guild.id }))
            .catch(err => auditLogDebug('webhookUpdate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('webhookUpdate', 'error inesperado:', err?.message || err);
    }
};
