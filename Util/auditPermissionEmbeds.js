// Plantilla para logs informativos de permisos (formato embed clasico)
const { EmbedBuilder } = require('discord.js');
const PERM_COLOR = 0xFEE75C;

function neutralizeMentions(value) {
    return String(value || '')
        .replace(/<@!?(\d+)>/g, 'ID usuario: $1')
        .replace(/<@&(\d+)>/g, 'ID rol: $1')
        .replace(/<#(\d+)>/g, 'ID canal: $1')
        .replace(/@/g, '@\u200b');
}

function permissionInfoEmbed({ moderatorId, reason, timeStr }) {
    return new EmbedBuilder()
        .setColor(PERM_COLOR)
        .setTitle('⚠️ Permisos insuficientes')
        .setDescription([
            'Intento de acción administrativa fallido por permisos insuficientes.',
            `Usuario: ${moderatorId ? `ID usuario: ${moderatorId}` : '-'}`,
            `Motivo: ${neutralizeMentions(reason || 'No especificado')}`,
            `🕒 ${timeStr}`,
        ].join('\n'));
}

module.exports = {
    permissionInfoEmbed,
};
