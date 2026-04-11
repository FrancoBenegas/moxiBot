const moxi = require('../../i18n');
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

const { ContainerBuilder, MessageFlags } = require('discord.js');

function buildPanel({ title, body }) {
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents(c => c.setContent(`# ${title}`))
    .addSeparatorComponents(s => s.setDivider(true))
    .addTextDisplayComponents(c => c.setContent(body));
  return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function formatPlatform(platform) {
  if (platform === 'twitch') return 'Twitch';
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'kick') return 'Kick';
  return platform;
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
      body: `${EMOJIS.cross} MongoDB no está disponible: ${error?.message || error}`,
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
      body: `${EMOJIS.cross} Uso: \`.livecanal #canal\``,
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
      `${EMOJIS.info || 'ℹ️'} Estado: **${enabled ? 'activo' : 'apagado'}**`,
      `${EMOJIS.channel || '#'} Canal: ${channelText}`,
      `${EMOJIS.folder || '📁'} Suscripciones: **${subscriptions.length}**`,
      '',
      'Plataformas soportadas: Twitch, YouTube, Kick.',
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
  if (subscriptions.length > 20) lines.push(`- ...y ${subscriptions.length - 20} más`);

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
      body: `${EMOJIS.cross} Uso: \`.liveadd <twitch|youtube|kick> <usuario>\``,
    }));
  }

  const settings = await getGuildSettingsCached(guildId);
  const channelId = settings?.StreamAlertsChannelId ? String(settings.StreamAlertsChannelId) : '';
  if (!channelId) {
    return message.reply(buildPanel({
      title: 'Directos',
      body: `${EMOJIS.cross} Primero configura el canal con \`.livecanal #canal\`.`,
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
      body: `${EMOJIS.cross} Uso: \`.liveremove <twitch|youtube|kick> <usuario>\``,
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
        ? `${EMOJIS.tick} Suscripción eliminada: ${formatPlatform(platform)} / ${normalizedUser}`
        : `${EMOJIS.cross} No encontré esa suscripción.`,
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
      body: `${EMOJIS.cross} Uso: \`.livecheck <twitch|youtube|kick> <usuario>\``,
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

    return message.reply(buildPanel({
      title: 'Directos',
      body: live.isLive
        ? `${EMOJIS.live || '🔴'} **LIVE** ${resolved.displayName || resolved.handle}\n${live.url || resolved.profileUrl}\n${live.title || 'Sin título'}`
        : `${EMOJIS.tick} ${resolved.displayName || resolved.handle} está offline ahora mismo.`,
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
    permissions: { User: ['Administrator'] },
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
