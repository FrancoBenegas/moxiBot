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
const { ButtonBuilder } = require('./compatButtonBuilder');

const logger = require('./logger');
const { EMOJIS } = require('./emojis');
const { getGuildSettingsCached } = require('./guildSettings');
const {
  listEnabledSubscriptions,
  setSubscriptionLiveState,
} = require('./streamAlertsStorage');
const { getStreamProvider } = require('./streamAlertsProviders');

const POLL_MS = Math.max(60_000, Number.parseInt(process.env.STREAM_ALERTS_POLL_MS || '', 10) || 120_000);
const DEFAULT_LIVE_REMINDER_MINUTES = Math.max(5, Number.parseInt(process.env.STREAM_ALERTS_LIVE_REMINDER_MINUTES || '', 10) || 60);

function formatPlatform(platform) {
  if (platform === 'twitch') return 'Twitch';
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'kick') return 'Kick';
  return platform;
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

async function buildStreamAlertMessage(subscription, status, type = 'start') {
  const platformName = formatPlatform(subscription.platform);
  const displayName = status.displayName || subscription.displayName || subscription.handle;
  const titleByType = {
    start: `${EMOJIS.redCircle || '🔴'} ${displayName} esta en directo en ${platformName}`,
    live: `${EMOJIS.redCircle || '🔴'} ${displayName} sigue en directo en ${platformName}`,
    end: `${EMOJIS.cross || 'X'} ${displayName} ha terminado en ${platformName}`,
  };

  const lines = [
    status.title ? `**Titulo:** ${status.title}` : null,
    `**Plataforma:** ${platformName}`,
    `**Canal:** ${subscription.handle}`,
    status.gameName ? `**Categoria:** ${String(status.gameName).slice(0, 100)}` : null,
    status.viewerCount !== undefined && status.viewerCount !== null ? `**Viewers:** ${status.viewerCount}` : null,
    status.startedAt ? `**Inicio:** <t:${Math.floor(new Date(status.startedAt).getTime() / 1000)}:R>` : null,
  ].filter(Boolean);

  const container = new ContainerBuilder()
    .setAccentColor(type === 'end' ? 0xe74c3c : 0x9146ff)
    .addTextDisplayComponents((c) => c.setContent(`# ${titleByType[type] || titleByType.start}`))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((c) => c.setContent(lines.join('\n')));

  const files = [];
  const mediaItems = [];
  const sameVisualSource = !!(status.avatarUrl && status.thumbnailUrl && status.avatarUrl === status.thumbnailUrl);
  const avatarAttachment = await buildRemoteAttachment(
    status.avatarUrl,
    `stream-avatar-${subscription.platform}-${subscription.handle}`
  );
  const imageAttachment = sameVisualSource
    ? null
    : await buildRemoteAttachment(
      status.thumbnailUrl,
      `stream-image-${subscription.platform}-${subscription.handle}`
    );

  if (avatarAttachment) {
    files.push(avatarAttachment.file);
    mediaItems.push(new MediaGalleryItemBuilder().setURL(avatarAttachment.attachmentUrl));
  } else if (status.avatarUrl) {
    mediaItems.push(new MediaGalleryItemBuilder().setURL(status.avatarUrl));
  }

  if (imageAttachment) {
    files.push(imageAttachment.file);
    mediaItems.push(new MediaGalleryItemBuilder().setURL(imageAttachment.attachmentUrl));
  } else if (status.thumbnailUrl && !sameVisualSource) {
    mediaItems.push(new MediaGalleryItemBuilder().setURL(status.thumbnailUrl));
  }

  if (mediaItems.length) {
    container.addSeparatorComponents((s) => s.setDivider(true));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...mediaItems));
  }

  const buttons = [];
  if (status.url || subscription.profileUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel(type === 'end' ? 'Abrir canal' : 'Abrir directo')
        .setStyle(ButtonStyle.Link)
        .setURL(status.url || subscription.profileUrl)
    );
  }
  if (subscription.profileUrl && subscription.profileUrl !== status.url) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('Ver canal')
        .setStyle(ButtonStyle.Link)
        .setURL(subscription.profileUrl)
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
  };
}

async function sendStreamAlert(client, subscription, status, type = 'start') {
  const channel = await client.channels.fetch(subscription.channelId).catch(() => null);
  if (!channel || typeof channel.send !== 'function' || !channel.isTextBased?.()) {
    throw new Error(`Canal no accesible: ${subscription.channelId}`);
  }

  const payload = await buildStreamAlertMessage(subscription, status, type);
  await channel.send(payload);
}

async function checkSubscription(client, subscription) {
  const { provider } = getStreamProvider(subscription.platform);
  const now = new Date();

  try {
    const guildSettings = await getGuildSettingsCached(subscription.guildId);
    const alertsEnabled = typeof guildSettings?.StreamAlertsEnabled === 'boolean'
      ? guildSettings.StreamAlertsEnabled
      : true;
    if (!alertsEnabled) return;

    const notifyStart = typeof guildSettings?.StreamAlertsNotifyStart === 'boolean'
      ? guildSettings.StreamAlertsNotifyStart
      : true;
    const notifyLive = typeof guildSettings?.StreamAlertsNotifyLive === 'boolean'
      ? guildSettings.StreamAlertsNotifyLive
      : false;
    const notifyEnd = typeof guildSettings?.StreamAlertsNotifyEnd === 'boolean'
      ? guildSettings.StreamAlertsNotifyEnd
      : true;
    const liveReminderMinutes = Math.max(
      5,
      Number.parseInt(String(guildSettings?.StreamAlertsLiveReminderMinutes || ''), 10) || DEFAULT_LIVE_REMINDER_MINUTES
    );
    const liveReminderMs = liveReminderMinutes * 60_000;

    const live = await provider.getLiveStatus(subscription);
    const nextState = {
      lastKnownLive: !!live.isLive,
      lastSessionId: live.sessionId || null,
      lastTitle: live.title || null,
      lastStartedAt: live.startedAt || null,
      lastCheckedAt: now,
      lastError: null,
      lastNotifiedAt: subscription.lastNotifiedAt || null,
      lastLiveReminderAt: subscription.lastLiveReminderAt || null,
    };

    const wentLive = !!live.isLive && (
      !subscription.lastKnownLive ||
      (live.sessionId && subscription.lastSessionId !== live.sessionId)
    );
    const wentOffline = !live.isLive && !!subscription.lastKnownLive;

    if (wentLive && notifyStart) {
      await sendStreamAlert(client, subscription, live, 'start');
      nextState.lastNotifiedAt = now;
      nextState.lastLiveReminderAt = now;
    }

    if (!wentLive && live.isLive && notifyLive) {
      const lastReminderAt = subscription.lastLiveReminderAt ? new Date(subscription.lastLiveReminderAt).getTime() : 0;
      if (!lastReminderAt || (now.getTime() - lastReminderAt) >= liveReminderMs) {
        await sendStreamAlert(client, subscription, live, 'live');
        nextState.lastLiveReminderAt = now;
      }
    }

    if (wentOffline && notifyEnd) {
      await sendStreamAlert(client, subscription, {
        isLive: false,
        sessionId: subscription.lastSessionId,
        title: subscription.lastTitle || `${subscription.displayName || subscription.handle} ha finalizado la transmision.`,
        url: subscription.profileUrl,
        thumbnailUrl: null,
        startedAt: subscription.lastStartedAt || now,
        displayName: subscription.displayName || subscription.handle,
      }, 'end');
      nextState.lastLiveReminderAt = null;
    }

    await setSubscriptionLiveState(subscription._id, nextState);
  } catch (error) {
    await setSubscriptionLiveState(subscription._id, {
      lastKnownLive: subscription.lastKnownLive,
      lastSessionId: subscription.lastSessionId,
      lastTitle: subscription.lastTitle,
      lastStartedAt: subscription.lastStartedAt,
      lastCheckedAt: now,
      lastNotifiedAt: subscription.lastNotifiedAt,
      lastLiveReminderAt: subscription.lastLiveReminderAt,
      lastError: error?.message || String(error),
    });
    logger.warn('[stream-alerts] fallo comprobando', subscription.platform, subscription.handle, '-', error?.message || error);
  }
}

async function runStreamAlertsPoll(client) {
  const subscriptions = await listEnabledSubscriptions();
  for (const subscription of subscriptions) {
    await checkSubscription(client, subscription);
  }
}

function startStreamAlerts(client) {
  if (client.__streamAlertsStarted) return;
  client.__streamAlertsStarted = true;

  const loop = async () => {
    if (client.__streamAlertsRunning) return;
    client.__streamAlertsRunning = true;
    try {
      await runStreamAlertsPoll(client);
    } catch (error) {
      logger.warn('[stream-alerts] polling error:', error?.message || error);
    } finally {
      client.__streamAlertsRunning = false;
    }
  };

  loop().catch(() => null);
  client.__streamAlertsInterval = setInterval(() => {
    loop().catch(() => null);
  }, POLL_MS);

  logger.info(`[stream-alerts] activo cada ${Math.round(POLL_MS / 1000)}s`);
}

module.exports = {
  startStreamAlerts,
};
