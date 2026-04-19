// Evento: actualización del servidor
const { guildUpdateEmbed } = require('../../../Util/auditGeneralEmbeds');
const audit = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (oldGuild, newGuild) => {
    try {
        const { channelId, enabled } = await audit.resolveAuditConfig(newGuild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = newGuild.channels.cache.get(channelId)
            || await newGuild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(guildUpdateEmbed({ oldName: oldGuild.name, newName: newGuild.name, timeStr }))
            .catch(err => auditLogDebug('guildUpdate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('guildUpdate', 'error inesperado:', err?.message || err);
    }
};
