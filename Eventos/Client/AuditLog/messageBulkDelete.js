
// Evento: mensajes eliminados masivamente
const { messageBulkDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { AuditLogEvent } = require('discord.js');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (messages) => {
    try {
        global.__moxiBulkDelete = true;
        setTimeout(() => { global.__moxiBulkDelete = false; }, 3000);
        if (!messages || messages.size === 0) return;
        const firstMsg = messages.first();
        const { guild, channel } = firstMsg;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');

        let deletedById = null;
        let deletedByTag = null;
        try {
            const fetched = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageBulkDelete, limit: 6 }).catch(() => null);
            const entries = fetched ? Array.from(fetched.entries.values()) : [];
            const nowMs = Date.now();
            const match = entries.find((entry) => {
                const age = nowMs - (entry?.createdTimestamp || 0);
                if (age < 0 || age > 15000) return false;
                const sameChannel = channel?.id ? entry?.extra?.channel?.id === channel.id : true;
                const countMatch = typeof entry?.extra?.count === 'number' ? entry.extra.count >= messages.size : true;
                return sameChannel && countMatch;
            });
            if (match?.executor?.id) {
                deletedById = match.executor.id;
                deletedByTag = match.executor.tag || null;
            }
        } catch {
            // Sin permisos de auditoría, el actor queda como no disponible.
        }

        await ch.send(messageBulkDeleteEmbed({
            channelId: channel.id,
            count: messages.size,
            timeStr,
            guildId: guild.id,
            deletedById,
            deletedByTag,
        }))
            .catch(err => auditLogDebug('messageBulkDelete', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('messageBulkDelete', 'error inesperado:', err?.message || err);
    }
};
