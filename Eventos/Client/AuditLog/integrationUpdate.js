const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: integración actualizada
const { integrationUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (oldIntegration, newIntegration) => {
    try {
        const { guild, name: oldName, id, type, account } = oldIntegration;
        const { name: newName } = newIntegration;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(integrationUpdateEmbed({ oldName, newName, id, type, account, timeStr }))
            .catch(err => auditLogDebug('integrationUpdate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('integrationUpdate', 'error inesperado:', err?.message || err);
    }
};
