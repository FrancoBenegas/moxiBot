// Evento: webhook eliminado
const { webhookDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (webhook) => {
    try {
        const { guild, name, id, channelId } = webhook;
        if (!guild) return;
        const { channelId: auditChannelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !auditChannelId) return;
        const ch = guild.channels.cache.get(auditChannelId)
            || await guild.channels.fetch(auditChannelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(webhookDeleteEmbed({ name, id, channelId, timeStr }))
            .catch(err => auditLogDebug('webhookDelete', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('webhookDelete', 'error inesperado:', err?.message || err);
    }
};
