const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: emoji actualizado
const { emojiUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (oldEmoji, newEmoji) => {
    try {
        const { guild, name: oldName, id, animated } = oldEmoji;
        const { name: newName } = newEmoji;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(emojiUpdateEmbed({ oldName, newName, id, animated, timeStr }))
            .catch(err => auditLogDebug('emojiUpdate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('emojiUpdate', 'error inesperado:', err?.message || err);
    }
};
