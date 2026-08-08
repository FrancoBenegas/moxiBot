// Evento: invitación eliminada

const { inviteDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');
const { snapshotGuildInvites } = require('../../../Util/inviteTracker');

module.exports = async (invite) => {
    const { guild, code, inviter, channel } = invite;

    // Refresh snapshot for join tracking.
    try { await snapshotGuildInvites(guild); } catch { }

    try {
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        await ch.send(inviteDeleteEmbed({ code, inviterId: inviter?.id, channelId: channel?.id, timeStr }))
            .catch(err => auditLogDebug('inviteDelete', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('inviteDelete', 'error inesperado:', err?.message || err);
    }
};
