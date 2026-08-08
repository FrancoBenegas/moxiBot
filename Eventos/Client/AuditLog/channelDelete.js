// Evento: canal eliminado
const { channelDeleteEmbed } = require('../../../Util/auditGeneralEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (channel) => {
    try {
        if (!channel.guild) return;
        const { channelId, enabled } = await resolveAuditConfig(channel.guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = channel.guild.channels.cache.get(channelId)
            || await channel.guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(channelDeleteEmbed({ channelName: channel.name, timeStr }))
            .catch(err => auditLogDebug('channelDelete', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('channelDelete', 'error inesperado:', err?.message || err);
    }
};
