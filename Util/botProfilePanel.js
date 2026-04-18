const {
    ActionRowBuilder,
    ActivityType,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { ButtonBuilder, ButtonStyle } = require('./compatButtonBuilder');
const { withSeasonTitle, formatGlobalFooter } = require('./seasonBrand');

function normalizeSpaces(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMultiline(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\s+$/g, ''))
        .join('\n')
        .trim();
}

function mapActivityType(rawType) {
    const type = normalizeSpaces(rawType).toLowerCase();
    if (!type) return null;

    const table = {
        playing: ActivityType.Playing,
        juego: ActivityType.Playing,
        jugando: ActivityType.Playing,
        streaming: ActivityType.Streaming,
        stream: ActivityType.Streaming,
        listening: ActivityType.Listening,
        escuchando: ActivityType.Listening,
        watching: ActivityType.Watching,
        viendo: ActivityType.Watching,
        competing: ActivityType.Competing,
        compitiendo: ActivityType.Competing,
    };

    return table[type] ?? null;
}

function mapStatus(rawStatus) {
    const status = normalizeSpaces(rawStatus).toLowerCase();
    const allowed = new Set(['online', 'idle', 'dnd', 'invisible']);
    if (!allowed.has(status)) return null;
    return status;
}

function activityTypeToInput(type) {
    switch (type) {
        case ActivityType.Playing: return 'playing';
        case ActivityType.Streaming: return 'streaming';
        case ActivityType.Listening: return 'listening';
        case ActivityType.Watching: return 'watching';
        case ActivityType.Competing: return 'competing';
        default: return '';
    }
}

async function getBotProfileSnapshot({ client, guild }) {
    const app = await client.application?.fetch?.().catch(() => null);
    const me = guild
        ? await guild.members.fetchMe().catch(() => guild.members.fetch(client.user.id).catch(() => guild.members.me || null))
        : null;
    const botUser = await client.user.fetch(true).catch(() => client.user);
    const current = client.user?.presence?.activities?.[0] || null;

    const avatarUrl =
        me?.displayAvatarURL?.({ extension: 'png', size: 1024 })
        || me?.avatarURL?.({ extension: 'png', size: 1024 })
        || botUser?.displayAvatarURL?.({ extension: 'png', size: 1024 })
        || null;
    const bannerUrl =
        me?.displayBannerURL?.({ extension: 'png', size: 2048 })
        || me?.bannerURL?.({ extension: 'png', size: 2048 })
        || botUser?.bannerURL?.({ extension: 'png', size: 2048 })
        || null;
    const guildBio = String(me?.bio || '').trim();

    return {
        username: String(client.user?.username || ''),
        userId: String(client.user?.id || ''),
        appDescription: String(app?.description || ''),
        guildBio,
        guildNickname: String(me?.nickname || ''),
        presenceStatus: String(client.user?.presence?.status || 'online'),
        activityName: String(current?.name || ''),
        activityType: current?.type,
        activityTypeInput: activityTypeToInput(current?.type),
        avatarUrl,
        bannerUrl,
    };
}

function buildButtons(ownerId) {
    const oid = String(ownerId || '0');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`botprofile:refresh:status:${oid}`).setStyle(ButtonStyle.Secondary).setLabel('Refrescar'),
        new ButtonBuilder().setCustomId(`botprofile:open:name:${oid}`).setStyle(ButtonStyle.Primary).setLabel('Nombre'),
        new ButtonBuilder().setCustomId(`botprofile:open:avatar:${oid}`).setStyle(ButtonStyle.Primary).setLabel('Avatar'),
        new ButtonBuilder().setCustomId(`botprofile:open:banner:${oid}`).setStyle(ButtonStyle.Primary).setLabel('Banner'),
        new ButtonBuilder().setCustomId(`botprofile:open:bio:${oid}`).setStyle(ButtonStyle.Primary).setLabel('Bio')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`botprofile:open:nick:${oid}`).setStyle(ButtonStyle.Secondary).setLabel('Apodo'),
        new ButtonBuilder().setCustomId(`botprofile:open:activity:${oid}`).setStyle(ButtonStyle.Secondary).setLabel('Actividad'),
        new ButtonBuilder().setCustomId(`botprofile:open:status:${oid}`).setStyle(ButtonStyle.Secondary).setLabel('Estado')
    );

    return [row1, row2];
}

async function buildBotProfilePanel({ client, guild, ownerId }) {
    const snap = await getBotProfileSnapshot({ client, guild });

    const lines = [
        `Usuario: **${snap.username || '-'}**`,
        `ID: **${snap.userId || '-'}**`,
        `Bio en este server: **${snap.guildBio || 'Sin bio local'}**`,
        `Bio global (app): **${snap.appDescription || '-'}**`,
        `Apodo en este server: **${snap.guildNickname || 'Sin apodo'}**`,
        `Estado: **${snap.presenceStatus || 'online'}**`,
        `Actividad: **${snap.activityName || 'Sin actividad'}**${snap.activityType != null ? ` (tipo ${snap.activityType})` : ''}`,
    ];

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(withSeasonTitle('🤖 Bot Profile Panel')))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

    if (snap.avatarUrl) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('Avatar'))
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(snap.avatarUrl)
                )
            );
    }

    if (snap.bannerUrl) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('Banner'))
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(snap.bannerUrl)
                )
            );
    }

    container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                formatGlobalFooter('Moxi', new Date().getFullYear())
            )
        );

    return {
        content: '',
        components: [container, ...buildButtons(ownerId)],
        flags: MessageFlags.IsComponentsV2,
    };
}

async function applyBotProfileChange({ client, guild, action, value, aux, requesterTag }) {
    const safeAction = normalizeSpaces(action).toLowerCase();

    if (safeAction === 'name') {
        const name = normalizeSpaces(value);
        if (!name) return { ok: false, message: 'Debes indicar un nombre.' };
        await client.user.setUsername(name);
        return { ok: true, message: `Nombre actualizado a **${name}**.` };
    }

    if (safeAction === 'avatar') {
        if (!guild) return { ok: false, message: 'Este cambio requiere servidor.' };
        const url = normalizeSpaces(value);
        if (!/^https?:\/\//i.test(url)) return { ok: false, message: 'Debes indicar una URL valida para avatar.' };
        await guild.members.editMe({ avatar: url, reason: `Cambio solicitado por ${requesterTag || 'owner'}` });
        return { ok: true, message: 'Avatar local del servidor actualizado.' };
    }

    if (safeAction === 'banner') {
        if (!guild) return { ok: false, message: 'Este cambio requiere servidor.' };
        const raw = normalizeSpaces(value);
        const off = ['off', 'none', 'remove', 'clear', 'quitar'].includes(raw.toLowerCase());
        if (!off && !/^https?:\/\//i.test(raw)) return { ok: false, message: 'Debes indicar una URL valida para banner o usar off.' };
        await guild.members.editMe({ banner: off ? null : raw, reason: `Cambio solicitado por ${requesterTag || 'owner'}` });
        return { ok: true, message: off ? 'Banner local del servidor removido.' : 'Banner local del servidor actualizado.' };
    }

    if (safeAction === 'bio') {
        if (!guild) return { ok: false, message: 'Este cambio requiere servidor.' };
        const text = normalizeMultiline(value);
        const off = ['off', 'none', 'remove', 'clear', 'quitar'].includes(text.toLowerCase());
        if (!off && !text) return { ok: false, message: 'Debes escribir una bio o usar off.' };
        await guild.members.editMe({ bio: off ? null : text, reason: `Cambio solicitado por ${requesterTag || 'owner'}` });
        return { ok: true, message: off ? 'Bio local del servidor removida.' : 'Bio local del servidor actualizada.' };
    }

    if (safeAction === 'nick') {
        if (!guild) return { ok: false, message: 'Este cambio requiere servidor.' };
        const text = normalizeSpaces(value);
        const off = ['off', 'none', 'remove', 'clear', 'quitar'].includes(text.toLowerCase());
        if (!off && !text) return { ok: false, message: 'Debes indicar un apodo o usar off.' };

        const me = guild.members.me || await guild.members.fetch(client.user.id);
        await me.setNickname(off ? null : text, `Cambio solicitado por ${requesterTag || 'owner'}`);
        return { ok: true, message: off ? 'Apodo removido.' : `Apodo actualizado a **${text}**.` };
    }

    if (safeAction === 'activity') {
        const type = mapActivityType(value);
        const name = normalizeSpaces(aux);
        if (!type || !name) {
            return { ok: false, message: 'Actividad invalida. Usa tipo y texto.' };
        }

        const activity = { name, type };
        if (type === ActivityType.Streaming) activity.url = 'https://twitch.tv/moxi';

        client.user.setPresence({
            activities: [activity],
            status: client.user?.presence?.status || 'online',
        });
        return { ok: true, message: 'Actividad actualizada.' };
    }

    if (safeAction === 'status') {
        const status = mapStatus(value);
        if (!status) {
            return { ok: false, message: 'Estado invalido. Usa online|idle|dnd|invisible.' };
        }

        client.user.setPresence({
            activities: client.user?.presence?.activities || [],
            status,
        });
        return { ok: true, message: `Estado actualizado a **${status}**.` };
    }

    return { ok: false, message: 'Accion no valida.' };
}

module.exports = {
    buildBotProfilePanel,
    applyBotProfileChange,
    getBotProfileSnapshot,
    normalizeMultiline,
    normalizeSpaces,
};
