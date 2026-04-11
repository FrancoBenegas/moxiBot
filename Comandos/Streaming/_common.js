const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const {
  AttachmentBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');

const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { ensureMongoConnection } = require('../../Util/mongoConnect');
const {
  getGuildSettingsCached,
  invalidateGuildSettingsCache,
  setGuildStreamAlertsChannel,
  setGuildStreamAlertsEnabled,
} = require('../../Util/guildSettings');
const {
  upsertSubscription,
  removeSubscription,
  listGuildSubscriptions,
  normalizePlatform,
  normalizeHandle,
  setGuildSubscriptionChannel,
} = require('../../Util/streamAlertsStorage');
const { getStreamProvider } = require('../../Util/streamAlertsProviders');

function formatPlatform(platform) {
  if (platform === 'twitch') return 'Twitch';
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'kick') return 'Kick';
  return platform;
}

function buildPanel({ title, body }) {
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents((c) => c.setContent(`# ${title}`))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((c) => c.setContent(String(body || '-')));

  return {
    content: '',
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { repliedUser: false },
  };
}

function guessFileExtension(url, fallback = 'png') {
  try {
    const pathname = new URL(url).pathname || '';
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : fallback;
  } catch {
    return fallback;
  }
}

async function buildRemoteAttachment(url, baseName) {
  if (!url) return null;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
    });
    let buffer = Buffer.from(response.data);
    let ext = guessFileExtension(url, 'png');
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();

    if (ext === 'webp' || contentType.includes('image/webp')) {
      const image = await loadImage(buffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      buffer = await canvas.encode('png');
      ext = 'png';
    }

    const name = `${baseName}.${ext}`;
    return {
      file: new AttachmentBuilder(buffer, { name }),
      attachmentUrl: `attachment://${name}`,
    };
  } catch {
    return null;
  }
}

async function buildStreamCheckMessage({ platform, resolved, live }) {
  const platformName = formatPlatform(platform);
  const displayName = resolved.displayName || resolved.handle;
  const targetUrl = live.url || resolved.profileUrl || null;
  const files = [];
  const container = new ContainerBuilder()
    .setAccentColor(0x9146ff)
    .addTextDisplayComponents((c) => c.setContent(`# ${EMOJIS.redCircle || '🔴'} ${displayName} esta en directo`))
    .addSeparatorComponents((s) => s.setDivider(true));

  const lines = [
    live.title ? `**Titulo:** ${live.title}` : null,
    `**Plataforma:** ${platformName}`,
    `**Canal:** ${resolved.handle}`,
    live.gameName ? `**Categoria:** ${String(live.gameName).slice(0, 100)}` : null,
    live.viewerCount !== undefined && live.viewerCount !== null ? `**Viewers:** ${live.viewerCount}` : null,
    live.startedAt ? `**Inicio:** <t:${Math.floor(new Date(live.startedAt).getTime() / 1000)}:R>` : null,
  ].filter(Boolean);

  container.addTextDisplayComponents((c) => c.setContent(lines.join('\n')));

  const mediaItems = [];
  const sameVisualSource = !!(live.avatarUrl && live.thumbnailUrl && live.avatarUrl === live.thumbnailUrl);
  const avatarAttachment = await buildRemoteAttachment(live.avatarUrl, `stream-avatar-${resolved.handle}`);
  const imageAttachment = sameVisualSource ? null : await buildRemoteAttachment(live.thumbnailUrl, `stream-image-${resolved.handle}`);

  if (avatarAttachment) {
    files.push(avatarAttachment.file);
    mediaItems.push(new MediaGalleryItemBuilder().setURL(avatarAttachment.attachmentUrl));
  } else if (live.avatarUrl) {
    mediaItems.push(new MediaGalleryItemBuilder().setURL(live.avatarUrl));
  }

  if (imageAttachment) {
    files.push(imageAttachment.file);
    mediaItems.push(new MediaGalleryItemBuilder().setURL(imageAttachment.attachmentUrl));
  } else if (live.thumbnailUrl && !sameVisualSource) {
    mediaItems.push(new MediaGalleryItemBuilder().setURL(live.thumbnailUrl));
  }

  if (mediaItems.length) {
    container.addSeparatorComponents((s) => s.setDivider(true));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...mediaItems));
  }

  const buttons = [];
  if (targetUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('Abrir directo')
        .setStyle(ButtonStyle.Link)
        .setURL(targetUrl)
    );
  }
  if (resolved.profileUrl && resolved.profileUrl !== targetUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('Ver canal')
        .setStyle(ButtonStyle.Link)
        .setURL(resolved.profileUrl)
    );
  }
  if (buttons.length) {
    container.addSeparatorComponents((s) => s.setDivider(true));
    container.addActionRowComponents((row) => row.addComponents(...buttons));
  }

  return {
    content: '',
    components: [container],
    files,
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { repliedUser: false },
  };
}

function parseChannelId(message, raw) {
  const mentioned = message.mentions?.channels?.first?.();
  if (mentioned?.id) return mentioned.id;
  if (!raw) return '';
  const id = String(raw).replace(/[<#>]/g, '').trim();
  return /^\d{15,30}$/.test(id) ? id : '';
}

async function ensureMongoForMessage(message) {
  try {
    await ensureMongoConnection();
    return null;
  } catch (error) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} MongoDB no esta disponible: ${error?.message || error}`,
    }));
  }
}

async function setChannel(message, rawChannel) {
  const mongoReply = await ensureMongoForMessage(message);
  if (mongoReply) return mongoReply;

  const guildId = message.guild?.id || 'dm';
  const channelId = parseChannelId(message, rawChannel);
  const channel = channelId
    ? (message.guild.channels.cache.get(channelId) || await message.guild.channels.fetch(channelId).catch(() => null))
    : null;

  if (!channel) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} Uso: \`.streamcanal #canal\``,
    }));
  }

  await setGuildStreamAlertsChannel(guildId, channel.id);
  await setGuildSubscriptionChannel(guildId, channel.id);
  invalidateGuildSettingsCache(guildId);

  return message.reply(buildPanel({
    title: 'Directos',
    body: `${EMOJIS.tick} Canal configurado en <#${channel.id}>.`,
  }));
}

async function setEnabled(message, enabled) {
  const mongoReply = await ensureMongoForMessage(message);
  if (mongoReply) return mongoReply;

  const guildId = message.guild?.id || 'dm';
  await setGuildStreamAlertsEnabled(guildId, enabled);
  invalidateGuildSettingsCache(guildId);

  return message.reply(buildPanel({
    title: 'Directos',
    body: `${EMOJIS.tick} Alertas de directos ${enabled ? 'activadas' : 'desactivadas'}.`,
  }));
}

async function showStatus(message) {
  const mongoReply = await ensureMongoForMessage(message);
  if (mongoReply) return mongoReply;

  const guildId = message.guild?.id || 'dm';
  const settings = await getGuildSettingsCached(guildId);
  const channelText = settings?.StreamAlertsChannelId ? `<#${settings.StreamAlertsChannelId}>` : '-';
  const enabled = typeof settings?.StreamAlertsEnabled === 'boolean' ? settings.StreamAlertsEnabled : true;
  const subscriptions = await listGuildSubscriptions(guildId);

  return message.reply(buildPanel({
    title: 'Directos',
    body: [
      `${EMOJIS.info || 'i'} Estado: **${enabled ? 'activo' : 'apagado'}**`,
      `${EMOJIS.channel || '#'} Canal: ${channelText}`,
      `${EMOJIS.folder || '[]'} Suscripciones: **${subscriptions.length}**`,
      '',
      'Plataformas soportadas: Twitch, YouTube y Kick.',
    ].join('\n'),
  }));
}

async function showList(message) {
  const mongoReply = await ensureMongoForMessage(message);
  if (mongoReply) return mongoReply;

  const guildId = message.guild?.id || 'dm';
  const subscriptions = await listGuildSubscriptions(guildId);
  if (!subscriptions.length) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} No hay suscripciones registradas.`,
    }));
  }

  const lines = subscriptions.slice(0, 20).map((item) => {
    const status = item.lastKnownLive ? 'LIVE' : 'offline';
    const errorText = item.lastError ? ` | error: ${item.lastError}` : '';
    return `- ${formatPlatform(item.platform)} | ${item.handle} | ${status}${errorText}`;
  });
  if (subscriptions.length > 20) lines.push(`- ...y ${subscriptions.length - 20} mas`);

  return message.reply(buildPanel({
    title: 'Directos',
    body: lines.join('\n'),
  }));
}

async function addSubscription(message, platformInput, userInput) {
  const mongoReply = await ensureMongoForMessage(message);
  if (mongoReply) return mongoReply;

  const guildId = message.guild?.id || 'dm';
  const platform = normalizePlatform(platformInput);
  const rawUser = String(userInput || '').trim();
  const normalizedUser = normalizeHandle(rawUser, platform);
  if (!platform || !rawUser) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} Uso: \`.streamadd <twitch|youtube|kick> <usuario>\``,
    }));
  }

  const settings = await getGuildSettingsCached(guildId);
  const channelId = settings?.StreamAlertsChannelId ? String(settings.StreamAlertsChannelId) : '';
  if (!channelId) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} Primero configura el canal con \`.streamcanal #canal\`.`,
    }));
  }

  try {
    const { provider } = getStreamProvider(platform);
    const resolved = await provider.resolve(normalizedUser);
    const saved = await upsertSubscription({
      guildId,
      channelId,
      platform,
      handle: resolved.handle,
      displayName: resolved.displayName,
      externalId: resolved.externalId,
      profileUrl: resolved.profileUrl,
      createdBy: message.author?.id,
    });

    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.tick} Registrado **${saved.displayName || saved.handle}** en ${formatPlatform(saved.platform)}.\nCanal: <#${saved.channelId}>`,
    }));
  } catch (error) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} ${error?.message || error}`,
    }));
  }
}

async function removeSubscriptionCommand(message, platformInput, userInput) {
  const mongoReply = await ensureMongoForMessage(message);
  if (mongoReply) return mongoReply;

  const guildId = message.guild?.id || 'dm';
  const platform = normalizePlatform(platformInput);
  const rawUser = String(userInput || '').trim();
  const normalizedUser = normalizeHandle(rawUser, platform);
  if (!platform || !rawUser) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} Uso: \`.streamremove <twitch|youtube|kick> <usuario>\``,
    }));
  }

  try {
    const { provider } = getStreamProvider(platform);
    let externalId = null;
    try {
      const resolved = await provider.resolve(normalizedUser);
      externalId = resolved.externalId || null;
    } catch {
      externalId = null;
    }

    const removed = await removeSubscription({ guildId, platform, handle: normalizedUser, externalId });
    return message.reply(buildPanel({
      title: 'Directos',
      body: removed
        ? `${EMOJIS.tick} Suscripcion eliminada: ${formatPlatform(platform)} / ${normalizedUser}`
        : `${EMOJIS.cross} No encontre esa suscripcion.`,
    }));
  } catch (error) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} ${error?.message || error}`,
    }));
  }
}

async function checkSubscription(message, platformInput, userInput) {
  const mongoReply = await ensureMongoForMessage(message);
  if (mongoReply) return mongoReply;

  const platform = normalizePlatform(platformInput);
  const rawUser = String(userInput || '').trim();
  const normalizedUser = normalizeHandle(rawUser, platform);
  if (!platform || !rawUser) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} Uso: \`.streamcheck <twitch|youtube|kick> <usuario>\``,
    }));
  }

  try {
    const { provider } = getStreamProvider(platform);
    const resolved = await provider.resolve(normalizedUser);
    const live = await provider.getLiveStatus({
      platform,
      handle: resolved.handle,
      externalId: resolved.externalId,
      displayName: resolved.displayName,
      profileUrl: resolved.profileUrl,
    });

    if (live.isLive) {
      return message.reply(await buildStreamCheckMessage({ platform, resolved, live }));
    }

    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.tick} ${resolved.displayName || resolved.handle} esta offline ahora mismo.`,
    }));
  } catch (error) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} ${error?.message || error}`,
    }));
  }
}

function baseCommand({ name, alias = [], usage, description, execute }) {
  return {
    name,
    alias,
    usage,
    description: () => description,
    Category: () => `${EMOJIS.redCircle || '🔴'} Streaming`,
    permissions: {
      User: ['Administrator'],
      Bot: ['SendMessages', 'AttachFiles'],
    },
    cooldown: 5,
    async execute(Moxi, message, args) {
      if (!message.guild) {
        return message.reply(buildPanel({
          title: 'Directos',
          body: `${EMOJIS.cross} Este comando solo funciona dentro de un servidor.`,
        }));
      }
      return execute(Moxi, message, args);
    },
  };
}

module.exports = {
  baseCommand,
  setChannel,
  setEnabled,
  showStatus,
  showList,
  addSubscription,
  removeSubscriptionCommand,
  checkSubscription,
};
