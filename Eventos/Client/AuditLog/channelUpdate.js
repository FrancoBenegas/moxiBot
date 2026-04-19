const { channelUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (oldChannel, newChannel) => {
    try {
        if (!oldChannel || !newChannel) return;
        const { guild, id: channelId, name: oldName, type: oldType } = oldChannel;
        const { name: newName, type: newType } = newChannel;
        if (!guild?.id) return;
        const { channelId: auditChannelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !auditChannelId) return;
        const ch = guild.channels.cache.get(auditChannelId)
            || await guild.channels.fetch(auditChannelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(channelUpdateEmbed({ channelId, oldName, newName, oldType, newType, timeStr, guildId: guild.id }))
            .catch(err => auditLogDebug('channelUpdate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('channelUpdate', 'error inesperado:', err?.message || err);
    }
};
