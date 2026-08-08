const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: integración creada
const { integrationCreateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (integration) => {
    try {
        const { guild, name, id, type, account } = integration;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(integrationCreateEmbed({ name, id, type, account, timeStr }))
            .catch(err => auditLogDebug('integrationCreate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('integrationCreate', 'error inesperado:', err?.message || err);
    }
};
