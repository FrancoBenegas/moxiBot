const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: emoji eliminado
const { emojiDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (emoji) => {
    try {
        const { guild, name, id, animated } = emoji;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(emojiDeleteEmbed({ name, id, animated, timeStr }))
            .catch(err => auditLogDebug('emojiDelete', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('emojiDelete', 'error inesperado:', err?.message || err);
    }
};
