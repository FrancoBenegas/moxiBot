// Plantillas V2 para logs de eventos de usuario y servidor
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const GENERAL_COLOR = 0xA259FF;

function memberRemoveEmbed({ userId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🔴 Usuario salió del servidor`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`El usuario <@${userId}> ha salido del servidor.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function channelCreateEmbed({ channelId, timeStr, guildId }) {
    const container = new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🟢 Canal creado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Se ha creado el canal <#${channelId}>.`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Creado • ${timeStr}`));
    const components = [container];
    if (guildId) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir al canal')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
                .setURL(`https://discord.com/channels/${guildId}/${channelId}`)
        );
        components.push(row);
    }
    return { components, flags: MessageFlags.IsComponentsV2 };
}

function channelDeleteEmbed({ channelName, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚫ Canal eliminado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Se ha eliminado el canal: ${channelName}.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function messageDeleteEmbed({ userId, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🟠 Mensaje eliminado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Un mensaje de <@${userId}> fue eliminado en <#${channelId}>.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function guildUpdateEmbed({ oldName, newName, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🟣 Servidor actualizado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Nombre anterior: ${oldName}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Nombre nuevo: ${newName}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
    memberRemoveEmbed,
    channelCreateEmbed,
    channelDeleteEmbed,
    messageDeleteEmbed,
    guildUpdateEmbed,
};
