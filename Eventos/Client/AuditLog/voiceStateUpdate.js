// Evento: entrada/salida/movimiento en canales de voz
const { voiceStateEmbed } = require('../../../Util/auditAdminEmbeds');
const audit = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (oldState, newState) => {
    try {
        const guild = newState.guild || oldState.guild;
        if (!guild) return;
        if (newState.member?.user?.bot || oldState.member?.user?.bot) return;

        const joined = !oldState.channelId && newState.channelId;
        const left = oldState.channelId && !newState.channelId;
        const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
        if (!joined && !left && !moved) return;

        const { channelId, enabled } = await audit.resolveAuditConfig(guild.id, 'es-ES');
        if (!enabled || !channelId) return;
        const ch = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return;

        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
        const userId = newState.member?.id || oldState.member?.id;
        const username = newState.member?.user?.username || oldState.member?.user?.username || null;
        const type = joined ? 'join' : left ? 'leave' : 'move';

        await ch.send(voiceStateEmbed({
            userId, username, type,
            oldChannelId: oldState.channelId,
            oldChannelName: oldState.channel?.name || null,
            newChannelId: newState.channelId,
            newChannelName: newState.channel?.name || null,
            timeStr,
            guildId: guild.id,
        })).catch(err => auditLogDebug('voiceStateUpdate', 'fallo al enviar:', err?.message || err));
    } catch (err) {
        auditLogDebug('voiceStateUpdate', 'error inesperado:', err?.message || err);
    }
};
