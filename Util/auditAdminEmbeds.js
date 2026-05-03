

const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');

function neutralizeMentions(value) {
    return String(value || '')
        .replace(/<@!?(\d+)>/g, 'ID usuario: $1')
        .replace(/<@&(\d+)>/g, 'ID rol: $1')
        .replace(/<#(\d+)>/g, 'ID canal: $1')
        .replace(/@/g, '@\u200b');
}

// Funciones de eventos de mensajes
function messageDeleteEmbed({ messageId, authorId, authorUsername, channelId, channelName, content, messageUrl, timeStr, deletedById = null, deletedByTag = null }) {
    const lines = [];

    // Canal
    const canalDisplay = channelName ? `#${channelName}` : `ID canal: ${channelId}`;
    lines.push(`**Canal:** ${canalDisplay}`);

    // Autor
    if (authorId) {
        const autorDisplay = authorUsername ? `${authorUsername} (ID usuario: ${authorId})` : `ID usuario: ${authorId}`;
        lines.push(`**Usuario:** ${autorDisplay}`);
    }
    if (deletedById) {
        const deleterDisplay = deletedByTag ? `${deletedByTag} (ID usuario: ${deletedById})` : `ID usuario: ${deletedById}`;
        lines.push(`**Eliminado por:** ${neutralizeMentions(deleterDisplay)}`);
    }

    const container = new ContainerBuilder()
        .setAccentColor(0xffa500)
        .addTextDisplayComponents(c => c.setContent(`## 🗑️ Mensaje Eliminado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(lines.join('\n')))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(
            content && content.trim()
                ? `**Contenido**\n${neutralizeMentions(content.trim().slice(0, 1000))}`
                : `**Contenido**\n*No disponible (mensaje no estaba en caché)*`
        ));

    container
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Eliminado • ${timeStr}`));

    const components = [container];

    const rowButtons = [];
    if (messageUrl) {
        rowButtons.push(
            new ButtonBuilder()
                .setLabel('Ir al contexto')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
                .setURL(messageUrl)
        );
    }
    if (deletedById) {
        rowButtons.push(
            new ButtonBuilder()
                .setLabel('Ver perfil de quien lo borró')
                .setStyle(ButtonStyle.Link)
                .setEmoji('👤')
                .setURL(`https://discord.com/users/${deletedById}`)
        );
    }
    if (rowButtons.length) {
        const row = new ActionRowBuilder().addComponents(...rowButtons);
        components.push(row);
    }

    return { components, flags: MessageFlags.IsComponentsV2 };
}

function messageUpdateEmbed({ authorId, authorUsername, channelId, channelName, oldContent, newContent, messageUrl, timeStr }) {
    const lines = [];

    const canalDisplay = channelName ? `#${channelName}` : `ID canal: ${channelId}`;
    lines.push(`**Canal:** ${canalDisplay}`);

    if (authorId) {
        const autorDisplay = authorUsername ? `${authorUsername} (ID usuario: ${authorId})` : `ID usuario: ${authorId}`;
        lines.push(`**Usuario:** ${autorDisplay}`);
    }

    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(c => c.setContent(`## ✏️ Mensaje Editado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(lines.join('\n')))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(
            `**Antes**\n${oldContent && oldContent.trim() ? neutralizeMentions(oldContent.trim().slice(0, 1000)) : '*No disponible*'}`
        ))
        .addSeparatorComponents(s => s.setDivider(false))
        .addTextDisplayComponents(c => c.setContent(
            `**Después**\n${newContent && newContent.trim() ? neutralizeMentions(newContent.trim().slice(0, 1000)) : '*Sin contenido*'}`
        ))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Editado • ${timeStr}`));

    const components = [container];

    if (messageUrl) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir al mensaje')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
                .setURL(messageUrl)
        );
        components.push(row);
    }

    return { components, flags: MessageFlags.IsComponentsV2 };
}

function messageBulkDeleteEmbed({ channelId, count, timeStr, guildId, deletedSamples = [], deletedById = null, deletedByTag = null }) {
    const sampleLines = Array.isArray(deletedSamples)
        ? deletedSamples.filter(Boolean).slice(0, 8)
        : [];

    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c => c.setContent(`## 🗑️ Mensajes eliminados masivamente`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se han eliminado **${count}** mensajes en el canal ID ${channelId}.`))
        .addTextDisplayComponents(c => c.setContent(
            deletedById
                ? `**Eliminado por:** ${neutralizeMentions(deletedByTag ? `${deletedByTag} (ID usuario: ${deletedById})` : `ID usuario: ${deletedById}`)}`
                : '**Eliminado por:** No disponible.'
        ))
        .addTextDisplayComponents(c => c.setContent(
            sampleLines.length
                ? `**Muestra de mensajes eliminados:**\n${sampleLines.map((line, i) => `${i + 1}. ${neutralizeMentions(line)}`).join('\n')}`
                : '**Muestra de mensajes eliminados:**\nNo disponible (mensaje no estaba en caché).'
        ))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Eliminado • ${timeStr}`));
    const components = [container];
    const rowButtons = [];
    if (guildId) {
        rowButtons.push(
            new ButtonBuilder()
                .setLabel('Ir al canal')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
                .setURL(`https://discord.com/channels/${guildId}/${channelId}`)
        );
    }
    if (deletedById) {
        rowButtons.push(
            new ButtonBuilder()
                .setLabel('Ver perfil de quien lo borró')
                .setStyle(ButtonStyle.Link)
                .setEmoji('👤')
                .setURL(`https://discord.com/users/${deletedById}`)
        );
    }
    if (rowButtons.length) {
        const row = new ActionRowBuilder().addComponents(...rowButtons);
        components.push(row);
    }
    return { components, flags: MessageFlags.IsComponentsV2 };
}

function stickerCreateEmbed({ name, id, format, timeStr }) {
    const ext = format === 3 ? null : format === 4 ? 'gif' : 'png';
    const stickerUrl = ext ? `https://cdn.discordapp.com/stickers/${id}.${ext}` : null;
    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(c => c.setContent(`## 🖼️ Sticker creado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Nombre:** ${name}\n**ID:** ${id}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Creado • ${timeStr}`));
    const components = [container];
    if (stickerUrl) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ver sticker')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🖼️')
                .setURL(stickerUrl)
        );
        components.push(row);
    }
    return { components, flags: MessageFlags.IsComponentsV2 };
}

function inviteDeleteEmbed({ code, inviterId, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x23272A)
        .addTextDisplayComponents(c => c.setContent(`# Invitación eliminada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha eliminado la invitación: \`${code}\` en el canal ID ${channelId}`))
        .addTextDisplayComponents(c => c.setContent(`Invitador: ${inviterId ? `ID usuario: ${inviterId}` : 'Desconocido'}`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function inviteCreateEmbed({ code, inviterId, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(c => c.setContent(`## 🔗 Invitación creada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Código:** \`${code}\`\n**Canal:** ID canal: ${channelId}\n**Creada por:** ${inviterId ? `ID usuario: ${inviterId}` : 'Desconocido'}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Creada • ${timeStr}`));
    const components = [container];
    if (code) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Usar invitación')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
                .setURL(`https://discord.gg/${code}`)
        );
        components.push(row);
    }
    return { components, flags: MessageFlags.IsComponentsV2 };
}

function channelUpdateEmbed({ channelId, oldName, newName, oldType, newType, timeStr, guildId }) {
    const lines = [];
    if (oldName !== newName) lines.push(`**Nombre:** \`${oldName}\` → \`${newName}\``);
    if (oldType !== newType) lines.push(`**Tipo:** \`${oldType}\` → \`${newType}\``);
    const desc = lines.length ? lines.join('\n') : 'Se actualizó el canal, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0xffcc00)
        .addTextDisplayComponents(c => c.setContent(`## ✏️ Canal actualizado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Canal:** ID canal: ${channelId}\n${desc}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Actualizado • ${timeStr}`));
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
function integrationUpdateEmbed({ oldName, newName, id, type, account, timeStr }) {
    let desc = '';
    if (oldName !== newName) desc += `**Nombre:** \`${oldName}\` → \`${newName}\`\n`;
    if (!desc) desc = 'Se actualizó la integración, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0x57F287)
        .addTextDisplayComponents(c => c.setContent(`# Integración actualizada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addTextDisplayComponents(c => c.setContent(`ID: ${id}`))
        .addTextDisplayComponents(c => c.setContent(`Tipo: ${type}`))
        .addTextDisplayComponents(c => c.setContent(`Cuenta: ${account?.name || 'desconocida'}`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function integrationDeleteEmbed({ name, id, type, account, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x23272A)
        .addTextDisplayComponents(c => c.setContent(`# Integración eliminada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha eliminado la integración **${name}** (ID: ${id}) de tipo **${type}** para la cuenta **${account?.name || 'desconocida'}**.`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function integrationCreateEmbed({ name, id, type, account, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(c => c.setContent(`# Integración creada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha creado la integración **${name}** (ID: ${id}) de tipo **${type}** para la cuenta **${account?.name || 'desconocida'}**.`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
// Embed para evento: Webhook actualizado
function webhookUpdateEmbed({ oldName, newName, id, oldChannelId, newChannelId, timeStr, guildId }) {
    const lines = [];
    if (oldName !== newName) lines.push(`**Nombre:** \`${oldName}\` → \`${newName}\``);
    if (oldChannelId !== newChannelId) lines.push(`**Canal:** ID canal ${oldChannelId} → ID canal ${newChannelId}`);
    const desc = lines.length ? lines.join('\n') : 'Se actualizó el webhook, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0xffcc00)
        .addTextDisplayComponents(c => c.setContent(`## ✏️ Webhook actualizado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Actualizado • ${timeStr}`));
    const components = [container];
    if (guildId) {
        const targetChannel = newChannelId || oldChannelId;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir al canal')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
                .setURL(`https://discord.com/channels/${guildId}/${targetChannel}`)
        );
        components.push(row);
    }
    return { components, flags: MessageFlags.IsComponentsV2 };
}

// Embed para evento: Webhook eliminado
function webhookDeleteEmbed({ name, id, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c => c.setContent(`# Webhook eliminado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha eliminado el webhook **${name}** (ID: ${id}) del canal ID ${channelId}.`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// Embed para evento: Webhook creado
function webhookCreateEmbed({ name, id, channelId, timeStr, guildId }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x77dd77)
        .addTextDisplayComponents(c => c.setContent(`## 🟢 Webhook creado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Nombre:** ${name}\n**Canal:** ID canal: ${channelId}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Creado • ${timeStr}`));
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

// Embed para evento: Emoji actualizado
function emojiUpdateEmbed({ oldName, newName, id, animated, timeStr }) {
    const url = animated
        ? `https://cdn.discordapp.com/emojis/${id}.gif`
        : `https://cdn.discordapp.com/emojis/${id}.png`;
    const desc = (oldName !== newName)
        ? `**Nombre:** \`${oldName}\` → \`${newName}\``
        : 'Se actualizó el emoji, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0xffcc00)
        .addTextDisplayComponents(c => c.setContent(`## ✏️ Emoji actualizado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Actualizado • ${timeStr}`));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Ver emoji')
            .setStyle(ButtonStyle.Link)
            .setEmoji('🖼️')
            .setURL(url)
    );
    return { components: [container, row], flags: MessageFlags.IsComponentsV2 };
}

// Embed para evento: Emoji eliminado
function emojiDeleteEmbed({ name, id, animated, timeStr }) {
    const url = animated
        ? `https://cdn.discordapp.com/emojis/${id}.gif`
        : `https://cdn.discordapp.com/emojis/${id}.png`;
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c => c.setContent(`## 🔴 Emoji eliminado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Nombre:** ${name}\n**Tipo:** ${animated ? 'Animado' : 'Estático'}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Eliminado • ${timeStr}`));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Ver emoji')
            .setStyle(ButtonStyle.Link)
            .setEmoji('🖼️')
            .setURL(url)
    );
    return { components: [container, row], flags: MessageFlags.IsComponentsV2 };
}

// Embed para evento: Emoji creado
function emojiCreateEmbed({ name, id, animated, timeStr }) {
    const url = animated
        ? `https://cdn.discordapp.com/emojis/${id}.gif`
        : `https://cdn.discordapp.com/emojis/${id}.png`;
    const container = new ContainerBuilder()
        .setAccentColor(0x77dd77)
        .addTextDisplayComponents(c => c.setContent(`## 🟢 Emoji creado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Nombre:** ${name}\n**Tipo:** ${animated ? 'Animado' : 'Estático'}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Creado • ${timeStr}`));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Ver emoji')
            .setStyle(ButtonStyle.Link)
            .setEmoji('🖼️')
            .setURL(url)
    );
    return { components: [container, row], flags: MessageFlags.IsComponentsV2 };
}

// Embed para evento: Rol actualizado
function roleUpdateEmbed({ oldName, newName, oldColor, newColor, oldPerms, newPerms, timeStr }) {
    const lines = [];
    if (oldName !== newName) lines.push(`**Nombre:** \`${oldName}\` → \`${newName}\``);
    if (oldColor !== newColor) lines.push(`**Color:** \`${oldColor}\` → \`${newColor}\``);
    if (oldPerms?.bitfield !== newPerms?.bitfield) lines.push(`**Permisos** actualizados`);
    const desc = lines.length ? lines.join('\n') : 'Se actualizó el rol, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0xffcc00)
        .addTextDisplayComponents(c => c.setContent(`## ✏️ Rol actualizado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// Embed para evento: Rol creado
function roleCreateEmbed({ roleName, roleId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x57F287)
        .addTextDisplayComponents(c => c.setContent(`## 🟢 Rol creado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Nombre:** ${roleName}\n**ID rol:** ${roleId}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Creado • ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// Embed para evento: Rol eliminado

function roleDeleteEmbed({ roleName, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c =>
            c.setContent(`# Rol eliminado`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`El rol **${roleName}** ha sido eliminado.`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`Fecha: ${timeStr}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent('© MoxiBot • 2026')
        );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function voiceStateEmbed({ userId, username, type, oldChannelId, oldChannelName, newChannelId, newChannelName, timeStr, guildId }) {
    const isJoin = type === 'join';
    const isLeave = type === 'leave';
    const isMove = type === 'move';

    const accentColor = isJoin ? 0x57F287 : isLeave ? 0xED4245 : 0xFEE75C;
    const icon = isJoin ? '🟢' : isLeave ? '🔴' : '🔀';
    const title = isJoin ? 'Entró a un canal de voz' : isLeave ? 'Salió de un canal de voz' : 'Cambió de canal de voz';

    const userDisplay = username ? `${username} (ID usuario: ${userId})` : `ID usuario: ${userId}`;
    const lines = [`**Usuario:** ${userDisplay}`];

    if (isJoin || isMove) {
        const ch = newChannelName ? `#${newChannelName}` : `ID canal: ${newChannelId}`;
        lines.push(`**Canal:** ${ch}`);
    }
    if (isLeave || isMove) {
        const ch = oldChannelName ? `#${oldChannelName}` : `ID canal: ${oldChannelId}`;
        if (isMove) {
            lines.push(`**Antes:** ${ch}`);
        } else {
            lines.push(`**Canal:** ${ch}`);
        }
    }

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(c => c.setContent(`## ${icon} ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(lines.join('\n')))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`${isJoin ? 'Entró' : isLeave ? 'Salió' : 'Movido'} • ${timeStr}`));

    const components = [container];
    if (guildId) {
        const targetChannelId = type === 'leave' ? oldChannelId : newChannelId;
        if (targetChannelId) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Ir al canal')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🔊')
                    .setURL(`https://discord.com/channels/${guildId}/${targetChannelId}`)
            );
            components.push(row);
        }
    }
    return { components, flags: MessageFlags.IsComponentsV2 };
}


module.exports = {
    messageDeleteEmbed,
    messageUpdateEmbed,
    messageBulkDeleteEmbed,
    voiceStateEmbed,
    channelUpdateEmbed,
    emojiCreateEmbed,
    emojiDeleteEmbed,
    emojiUpdateEmbed,
    integrationCreateEmbed,
    integrationDeleteEmbed,
    integrationUpdateEmbed,
    inviteCreateEmbed,
    inviteDeleteEmbed,
    roleCreateEmbed,
    roleDeleteEmbed,
    roleUpdateEmbed,
    stickerCreateEmbed,
    webhookCreateEmbed,
    webhookDeleteEmbed,
    webhookUpdateEmbed,
};
