const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: usuario sale del servidor
const { memberRemoveEmbed } = require('../../../Util/auditGeneralEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (member) => {
    try {
        const { guild, id: userId } = member;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(memberRemoveEmbed({ userId, timeStr }))
            .catch(err => auditLogDebug('guildMemberRemove', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('guildMemberRemove', 'error inesperado:', err?.message || err);
    }
};
