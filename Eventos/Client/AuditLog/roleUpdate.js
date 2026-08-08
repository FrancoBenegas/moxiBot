
// Evento: rol actualizado
const { roleUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (oldRole, newRole) => {
    try {
        const { guild, name: oldName, color: oldColor, permissions: oldPerms } = oldRole;
        const { name: newName, color: newColor, permissions: newPerms } = newRole;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(roleUpdateEmbed({ oldName, newName, oldColor, newColor, oldPerms, newPerms, timeStr }))
            .catch(err => auditLogDebug('roleUpdate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('roleUpdate', 'error inesperado:', err?.message || err);
    }
};
