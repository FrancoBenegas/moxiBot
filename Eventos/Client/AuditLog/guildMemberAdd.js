const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento para registrar la entrada de un usuario en el canal de auditoría
const { memberJoinEmbed } = require('../../../Util/auditMemberEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const { detectUsedInviteOnJoin } = require('../../../Util/inviteTracker');

module.exports = async (member) => {
    try {
        const { guild, id: userId } = member;
        if (!guild) return;
        const { channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        let inviteLine = '';
        try {
            const used = await detectUsedInviteOnJoin(member);
            if (used?.code) {
                const who = used.requestedByUserId ? `<@${used.requestedByUserId}>` : (used.requestedByTag || 'Desconocido');
                inviteLine = `Invitación usada: https://discord.gg/${used.code} (solicitada por: ${who})`;
            }
        } catch { }
        await ch.send(memberJoinEmbed({ userId, timeStr, inviteLine }))
            .catch(err => auditLogDebug('guildMemberAdd', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('guildMemberAdd', 'error inesperado:', err?.message || err);
    }
};
