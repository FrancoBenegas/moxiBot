// Evento: sticker creado

const { stickerCreateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (sticker) => {
    try {
        const { guild, name, id, format } = sticker;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(stickerCreateEmbed({ name, id, format, timeStr }))
            .catch(err => auditLogDebug('stickerCreate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('stickerCreate', 'error inesperado:', err?.message || err);
    }
};
