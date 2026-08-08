const StreamAlertSubscription = require('../Models/StreamAlertSubscriptionSchema');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const SUPPORTED_PLATFORMS = new Set(['twitch', 'youtube', 'kick']);

function normalizePlatform(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'yt') return 'youtube';
  return raw;
}

function normalizeHandle(value, platform) {
  let raw = normalizeDbText(value, { maxLen: 120, fallback: '' }).trim();
  if (!raw) return '';
  raw = raw.split(/\s+/)[0] || raw;
  raw = raw.replace(/[?#].*$/, '');

  if (platform === 'twitch') {
    try {
      const parsed = new URL(raw);
      const host = String(parsed.hostname || '').toLowerCase();
      if (host === 'twitch.tv' || host === 'www.twitch.tv' || host === 'm.twitch.tv') {
        raw = parsed.pathname || raw;
      }
    } catch {
      // No es URL; seguimos con limpieza por texto.
    }
    raw = raw.replace(/^\/+/, '');
    raw = raw.replace(/^https?:\/\/([a-z0-9-]+\.)?twitch\.tv\//i, '');
    raw = raw.replace(/\/(about|schedule|videos|clips)$/i, '');
    raw = raw.split('/')[0] || raw;
    raw = raw.replace(/^@/, '');
    return raw.toLowerCase();
  }

  if (platform === 'youtube') {
    raw = raw.replace(/^\/+/, '');
    raw = raw.replace(/^https?:\/\/(www\.)?youtube\.com\//i, '');
    raw = raw.replace(/^channel\//i, '');
    raw = raw.replace(/^c\//i, '@');
    raw = raw.replace(/^user\//i, '@');
    raw = raw.replace(/^@?/, '@');
    if (/^@channel\//i.test(raw)) raw = raw.replace(/^@channel\//i, 'UC');
    raw = raw.replace(/\/(featured|videos|streams|live|about)$/i, '');
    if (raw.startsWith('@')) raw = raw.split('/')[0] || raw;
    if (/^UC[\w-]{20,}$/i.test(raw.replace(/^@/, ''))) return raw.replace(/^@/, '');
    return raw.toLowerCase();
  }

  if (platform === 'kick') {
    raw = raw.replace(/^https?:\/\/(www\.)?kick\.com\//i, '');
    raw = raw.split('/')[0] || raw;
    raw = raw.replace(/^@/, '');
    return raw.toLowerCase();
  }

  if (platform === 'kick') {
    raw = raw.replace(/^https?:\/\/(www\.)?kick\.com\//i, '');
    raw = raw.split('/')[0] || raw;
    raw = raw.replace(/^@/, '');
    return raw.toLowerCase();
  }

  return raw.toLowerCase();
}

async function upsertSubscription(input) {
  const guildId = normalizeDiscordId(input.guildId);
  const channelId = normalizeDiscordId(input.channelId);
  const platform = normalizePlatform(input.platform);
  const handle = normalizeHandle(input.handle, platform);
  const externalId = normalizeDbText(input.externalId, { maxLen: 120, fallback: null });
  const createdBy = normalizeDiscordId(input.createdBy);

  if (!guildId || !channelId || !platform || !handle) {
    throw new Error('Datos incompletos para guardar la suscripcion.');
  }

  const identityQuery = externalId
    ? { guildId, platform, externalId }
    : { guildId, platform, handle };

  const payload = {
    guildId,
    platform,
    handle,
    channelId,
    enabled: input.enabled !== false,
    displayName: normalizeDbText(input.displayName, { maxLen: 120, fallback: null }),
    externalId,
    profileUrl: normalizeDbText(input.profileUrl, { maxLen: 300, fallback: null }),
    lastError: null,
    createdBy: createdBy || null,
  };

  const existing = await StreamAlertSubscription.findOne(identityQuery);
  if (existing) {
    existing.handle = payload.handle;
    existing.channelId = payload.channelId;
    existing.enabled = payload.enabled;
    existing.displayName = payload.displayName;
    existing.externalId = payload.externalId;
    existing.profileUrl = payload.profileUrl;
    existing.lastError = null;
    if (!existing.createdBy && payload.createdBy) existing.createdBy = payload.createdBy;
    await existing.save();
    return existing.toObject();
  }

  const created = await StreamAlertSubscription.create(payload);
  return created.toObject();
}

async function removeSubscription({ guildId, platform, handle, externalId }) {
  const safeGuildId = normalizeDiscordId(guildId);
  const safePlatform = normalizePlatform(platform);
  const safeHandle = normalizeHandle(handle, safePlatform);
  const safeExternalId = normalizeDbText(externalId, { maxLen: 120, fallback: null });
  const query = safeExternalId
    ? { guildId: safeGuildId, platform: safePlatform, externalId: safeExternalId }
    : { guildId: safeGuildId, platform: safePlatform, handle: safeHandle };
  const result = await StreamAlertSubscription.deleteOne(query);
  return result.deletedCount > 0;
}

async function listGuildSubscriptions(guildId) {
  const docs = await StreamAlertSubscription.find({
    guildId: normalizeDiscordId(guildId),
  }).sort({ platform: 1, handle: 1 }).lean();
  return docs.filter((item) => SUPPORTED_PLATFORMS.has(String(item?.platform || '').toLowerCase()));
}

async function listEnabledSubscriptions() {
  const docs = await StreamAlertSubscription.find({
    enabled: true,
  }).lean();
  return docs.filter((item) => SUPPORTED_PLATFORMS.has(String(item?.platform || '').toLowerCase()));
}

async function setGuildSubscriptionChannel(guildId, channelId) {
  const safeGuildId = normalizeDiscordId(guildId);
  const safeChannelId = normalizeDiscordId(channelId);
  if (!safeGuildId || !safeChannelId) return 0;
  const result = await StreamAlertSubscription.updateMany({ guildId: safeGuildId }, { $set: { channelId: safeChannelId } });
  return result.modifiedCount || 0;
}

async function setSubscriptionLiveState(subscriptionId, nextState) {
  await StreamAlertSubscription.updateOne({ _id: subscriptionId }, {
    $set: {
      lastKnownLive: !!nextState.lastKnownLive,
      lastSessionId: normalizeDbText(nextState.lastSessionId, { maxLen: 120, fallback: null }),
      lastTitle: normalizeDbText(nextState.lastTitle, { maxLen: 300, fallback: null }),
      lastStartedAt: nextState.lastStartedAt || null,
      lastNotifiedAt: nextState.lastNotifiedAt || null,
      lastLiveReminderAt: nextState.lastLiveReminderAt || null,
      lastCheckedAt: nextState.lastCheckedAt || new Date(),
      lastError: normalizeDbText(nextState.lastError, { maxLen: 300, fallback: null }),
    },
  });
}

module.exports = {
  normalizePlatform,
  normalizeHandle,
  upsertSubscription,
  removeSubscription,
  listGuildSubscriptions,
  listEnabledSubscriptions,
  setGuildSubscriptionChannel,
  setSubscriptionLiveState,
};
