const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: emoji creado
const { emojiCreateEmbed } = require('../../../Util/auditAdminEmbeds');
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
        await ch.send(emojiCreateEmbed({ name, id, animated, timeStr }))
            .catch(err => auditLogDebug('emojiCreate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('emojiCreate', 'error inesperado:', err?.message || err);
    }
};
