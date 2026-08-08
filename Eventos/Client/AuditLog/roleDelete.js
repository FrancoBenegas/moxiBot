
// Evento: rol eliminado
const { roleDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (role) => {
    try {
        const { guild, name } = role;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(roleDeleteEmbed({ roleName: name, timeStr }))
            .catch(err => auditLogDebug('roleDelete', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('roleDelete', 'error inesperado:', err?.message || err);
    }
};
