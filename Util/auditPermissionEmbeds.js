// Plantilla para logs informativos de permisos
// Plantilla V2 para logs informativos de permisos insuficientes
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const PERM_COLOR = 0xFEE75C;
const PERM_ICON = 'https://cdn.discordapp.com/emojis/802917097851469834.png';

function neutralizeMentions(value) {
    return String(value || '')
        .replace(/<@!?(\d+)>/g, 'ID usuario: $1')
        .replace(/<@&(\d+)>/g, 'ID rol: $1')
        .replace(/<#(\d+)>/g, 'ID canal: $1')
        .replace(/@/g, '@\u200b');
}

function permissionInfoEmbed({ moderatorId, reason, timeStr }) {
    return new ContainerBuilder()
        .setAccentColor(PERM_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚠️ Permisos insuficientes`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Intento de acción administrativa fallido por permisos insuficientes.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Usuario: ${moderatorId ? `ID usuario: ${moderatorId}` : '-'}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Motivo: ${neutralizeMentions(reason || 'No especificado')}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
}

module.exports = {
    permissionInfoEmbed,
};
