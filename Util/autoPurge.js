const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId } = require('./idGuards');
const { setGuildAutoPurgeConfig } = require('../Models/GuildSettings');
const logger = require('./logger');

const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_INTERVAL_HOURS = 24;
const MAX_DELETE_PER_CHANNEL = 100;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function canPurgeInChannel(channel) {
  try {
    if (!channel?.isTextBased?.()) return false;
    if (!channel?.guild?.members?.me) return false;
    const perms = channel.permissionsFor(channel.guild.members.me);
    return perms?.has?.('ManageMessages');
  } catch {
    return false;
  }
}

async function purgeRecentMessages(channel, amount) {
  if (!channel?.messages?.fetch) return { deletedCount: 0, attempted: 0 };

  const limit = Math.max(1, Math.min(MAX_DELETE_PER_CHANNEL, Number(amount) || MAX_DELETE_PER_CHANNEL));
  const fetched = await channel.messages.fetch({ limit: Math.min(100, limit + 10) });

  const candidates = [];
  for (let i = 0, msg = fetched.at(i); i < limit; i += 1, msg = fetched.at(i)) {
    if (!msg) break;
    if (!msg.pinned) candidates.push(msg);
  }

  const cutoff = Date.now() - FOURTEEN_DAYS_MS;
  const bulkIds = [];
  const oldOnes = [];

  for (const msg of candidates) {
    if ((msg.createdTimestamp || 0) < cutoff) oldOnes.push(msg);
    else bulkIds.push(msg.id);
  }

  let bulkCount = 0;
  if (bulkIds.length && typeof channel.bulkDelete === 'function') {
    const deleted = await channel.bulkDelete(bulkIds, true);
    bulkCount = typeof deleted === 'number' ? deleted : (deleted?.size ?? 0);
    if (bulkCount === 0 && bulkIds.length > 0) bulkCount = bulkIds.length;
  }

  let oldCount = 0;
  for (const msg of oldOnes) {
    try {
      await msg.delete();
      oldCount += 1;
    } catch {
      // ignore individual failures
    }
  }

  return { deletedCount: bulkCount + oldCount, attempted: candidates.length };
}

function extractGuildId(doc) {
  return normalizeDiscordId(doc?.guildID) || normalizeDiscordId(doc?.guildId) || normalizeDiscordId(doc?.id) || null;
}

function shouldRunNow(doc) {
  const enabled = !!doc?.AutoPurgeEnabled;
  if (!enabled) return false;

  const intervalHoursRaw = Number.parseInt(String(doc?.AutoPurgeIntervalHours ?? DEFAULT_INTERVAL_HOURS), 10);
  const intervalHours = Number.isFinite(intervalHoursRaw) ? Math.max(1, Math.min(168, intervalHoursRaw)) : DEFAULT_INTERVAL_HOURS;
  const lastRunAt = doc?.AutoPurgeLastRunAt ? new Date(doc.AutoPurgeLastRunAt) : null;

  if (!lastRunAt || !Number.isFinite(lastRunAt.getTime())) return true;
  const elapsed = Date.now() - lastRunAt.getTime();
  return elapsed >= intervalHours * ONE_HOUR_MS;
}

async function runAutoPurgeCycle(Moxi) {
  const connection = await ensureMongoConnection();
  const db = connection.db;

  const docs = await db.collection('prefixes').find({ AutoPurgeEnabled: true }).toArray();
  for (const doc of docs) {
    const guildId = extractGuildId(doc);
    if (!guildId || !shouldRunNow(doc)) continue;

    const channels = Array.isArray(doc?.AutoPurgeChannels)
      ? doc.AutoPurgeChannels.map((id) => normalizeDiscordId(id)).filter(Boolean)
      : [];

    if (!channels.length) {
      await setGuildAutoPurgeConfig(guildId, { lastRunAt: new Date() });
      continue;
    }

    let totalDeleted = 0;

    for (const channelId of channels) {
      try {
        const channel = await Moxi.channels.fetch(channelId).catch(() => null);
        if (!channel || String(channel.guild?.id || '') !== String(guildId)) continue;
        if (!canPurgeInChannel(channel)) continue;

        const result = await purgeRecentMessages(channel, MAX_DELETE_PER_CHANNEL);
        totalDeleted += Number(result?.deletedCount || 0);
      } catch (error) {
        logger.warn?.('[autopurge] channel purge failed', { guildId, channelId, error: error?.message || String(error) });
      }
    }

    await setGuildAutoPurgeConfig(guildId, { lastRunAt: new Date(), intervalHours: DEFAULT_INTERVAL_HOURS });
    logger.info?.('[autopurge] cycle complete', { guildId, channels: channels.length, deleted: totalDeleted });
  }
}

function startAutoPurge(Moxi) {
  if (!Moxi || Moxi.__autoPurgeInterval) return;

  const run = () => runAutoPurgeCycle(Moxi).catch((error) => {
    logger.warn?.('[autopurge] cycle failed', { error: error?.message || String(error) });
  });

  run();
  Moxi.__autoPurgeInterval = setInterval(run, ONE_HOUR_MS);
}

module.exports = {
  startAutoPurge,
  runAutoPurgeCycle,
};
