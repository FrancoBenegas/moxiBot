const { EmbedBuilder } = require('discord.js');

const logger = require('./logger');
const { EMOJIS } = require('./emojis');
const { getGuildSettingsCached } = require('./guildSettings');
const {
  listEnabledSubscriptions,
  setSubscriptionLiveState,
} = require('./streamAlertsStorage');
const { getStreamProvider } = require('./streamAlertsProviders');

const POLL_MS = Math.max(60_000, Number.parseInt(process.env.STREAM_ALERTS_POLL_MS || '', 10) || 120_000);

function formatPlatform(platform) {
  if (platform === 'twitch') return 'Twitch';
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'kick') return 'Kick';
  return platform;
}

function buildStreamEmbed(subscription, status) {
  const platformName = formatPlatform(subscription.platform);
  const displayName = status.displayName || subscription.displayName || subscription.handle;
  const embed = new EmbedBuilder()
    .setColor(0x9146ff)
    .setTitle(`${displayName} está en directo en ${platformName}`)
    .setURL(status.url || subscription.profileUrl || null)
    .setDescription(status.title || `${displayName} ha empezado una transmisión.`)
    .addFields(
      { name: 'Plataforma', value: platformName, inline: true },
      { name: 'Canal', value: subscription.handle, inline: true },
    )
    .setTimestamp(status.startedAt || new Date());

  if (status.gameName) {
    embed.addFields({ name: 'Categoría', value: String(status.gameName).slice(0, 100), inline: true });
  }
  if (status.viewerCount) {
    embed.addFields({ name: 'Viewers', value: String(status.viewerCount), inline: true });
  }
  if (status.thumbnailUrl) {
    embed.setImage(status.thumbnailUrl);
  }

  return embed;
}

async function sendStreamAlert(client, subscription, status) {
  const channel = await client.channels.fetch(subscription.channelId).catch(() => null);
  if (!channel || typeof channel.send !== 'function' || !channel.isTextBased?.()) {
    throw new Error(`Canal no accesible: ${subscription.channelId}`);
  }

  const embed = buildStreamEmbed(subscription, status);
  await channel.send({
    content: `${EMOJIS.live || '🔴'} **LIVE**`,
    embeds: [embed],
  });
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

    const live = await provider.getLiveStatus(subscription);
    const nextState = {
      lastKnownLive: !!live.isLive,
      lastSessionId: live.sessionId || null,
      lastTitle: live.title || null,
      lastStartedAt: live.startedAt || null,
      lastCheckedAt: now,
      lastError: null,
      lastNotifiedAt: subscription.lastNotifiedAt || null,
    };

    const wentLive = !!live.isLive && (
      !subscription.lastKnownLive ||
      (live.sessionId && subscription.lastSessionId !== live.sessionId)
    );

    if (wentLive) {
      await sendStreamAlert(client, subscription, live);
      nextState.lastNotifiedAt = now;
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
      lastError: error?.message || String(error),
    });
    logger.warn('[stream-alerts] fallo comprobando', subscription.platform, subscription.handle, '-', error?.message || error);
  }
}

async function runStreamAlertsPoll(client) {
  const subscriptions = await listEnabledSubscriptions();
  for (const subscription of subscriptions) {
    // secuencial para no pegar picos de rate limit a Twitch/YouTube
    // y porque el volumen esperado en este bot es pequeño.
    // Si crece, aquí conviene meter concurrencia limitada.
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
