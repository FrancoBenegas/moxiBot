// Evento: canal creado

const { channelCreateEmbed } = require('../../../Util/auditGeneralEmbeds');
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
        await ch.send(channelCreateEmbed({ channelId: channel.id, timeStr, guildId: channel.guild.id }))
            .catch(err => auditLogDebug('channelCreate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('channelCreate', 'error inesperado:', err?.message || err);
    }
};
