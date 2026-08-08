// Evento: webhook creado
const { webhookCreateEmbed } = require('../../../Util/auditAdminEmbeds');
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
        await ch.send(webhookCreateEmbed({ name, id, channelId, timeStr, guildId: guild.id }))
            .catch(err => auditLogDebug('webhookCreate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('webhookCreate', 'error inesperado:', err?.message || err);
    }
};
