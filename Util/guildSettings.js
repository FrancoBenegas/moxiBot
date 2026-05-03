// Redirigir a la implementacion de Models/GuildSettings.js (MongoClient)
const {
  setGuildLanguage: setGuildLanguageRaw,
  getGuildSettings,
  setGuildPrefix: setGuildPrefixRaw,
  setGuildAuditChannel,
  setGuildAuditEnabled,
  setGuildStreamAlertsChannel: setGuildStreamAlertsChannelRaw,
  setGuildStreamAlertsEnabled: setGuildStreamAlertsEnabledRaw,
  setGuildStreamAlertEventEnabled: setGuildStreamAlertEventEnabledRaw,
  setGuildStreamLiveReminderMinutes: setGuildStreamLiveReminderMinutesRaw,
  setGuildEconomyEnabled: setGuildEconomyEnabledRaw,
  setGuildEconomyChannel: setGuildEconomyChannelRaw,
  setGuildEconomyExclusive: setGuildEconomyExclusiveRaw,
  setGuildModuleEnabled: setGuildModuleEnabledRaw,
  setGuildMusicPanelConfig: setGuildMusicPanelConfigRaw,
  touchGuildMusicPanelActivity: touchGuildMusicPanelActivityRaw,
  setGuildMusicPanelActive: setGuildMusicPanelActiveRaw,
  setGuildUpdatesChannel: setGuildUpdatesChannelRaw,
  setGuildUpdatesAutoEnabled: setGuildUpdatesAutoEnabledRaw,
  setGuildUpdatesLastAnnouncedVersion: setGuildUpdatesLastAnnouncedVersionRaw,
  setGuildUpdatesLastAnnouncedCommit: setGuildUpdatesLastAnnouncedCommitRaw,
} = require('../Models/GuildSettings');

const DEFAULT_SETTINGS_TTL_MS = Number.parseInt(process.env.GUILD_SETTINGS_TTL_MS || '', 10) || (5 * 60 * 1000);
const guildSettingsCache = new Map();

async function getGuildSettingsCached(guildId, ttlMs = DEFAULT_SETTINGS_TTL_MS) {
  const now = Date.now();
  const cached = guildSettingsCache.get(guildId);
  if (cached && cached.expiresAt > now) return cached.settings;
  const settings = await getGuildSettings(guildId);
  guildSettingsCache.set(guildId, { settings, expiresAt: now + ttlMs });
  return settings;
}

function invalidateGuildSettingsCache(guildId) {
  if (!guildId) return;
  guildSettingsCache.delete(guildId);
}

async function setGuildLanguage(guildId, lang, ownerId) {
  const ok = await setGuildLanguageRaw(guildId, lang, ownerId);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildPrefix(guildId, prefix) {
  const ok = await setGuildPrefixRaw(guildId, prefix);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildEconomyEnabled(guildId, enabled) {
  const ok = await setGuildEconomyEnabledRaw(guildId, enabled);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildEconomyChannel(guildId, channelId) {
  const ok = await setGuildEconomyChannelRaw(guildId, channelId);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildEconomyExclusive(guildId, exclusive) {
  const ok = await setGuildEconomyExclusiveRaw(guildId, exclusive);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildModuleEnabled(guildId, moduleId, enabled) {
  const ok = await setGuildModuleEnabledRaw(guildId, moduleId, enabled);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildMusicPanelConfig(guildId, patch) {
  const ok = await setGuildMusicPanelConfigRaw(guildId, patch);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function touchGuildMusicPanelActivity(guildId, payload) {
  const ok = await touchGuildMusicPanelActivityRaw(guildId, payload);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildMusicPanelActive(guildId, active) {
  const ok = await setGuildMusicPanelActiveRaw(guildId, active);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildStreamAlertsChannel(guildId, channelId) {
  const ok = await setGuildStreamAlertsChannelRaw(guildId, channelId);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildStreamAlertsEnabled(guildId, enabled) {
  const ok = await setGuildStreamAlertsEnabledRaw(guildId, enabled);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildStreamAlertEventEnabled(guildId, eventName, enabled) {
  const ok = await setGuildStreamAlertEventEnabledRaw(guildId, eventName, enabled);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildStreamLiveReminderMinutes(guildId, minutes) {
  const ok = await setGuildStreamLiveReminderMinutesRaw(guildId, minutes);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildUpdatesChannel(guildId, channelId) {
  const ok = await setGuildUpdatesChannelRaw(guildId, channelId);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildUpdatesAutoEnabled(guildId, enabled) {
  const ok = await setGuildUpdatesAutoEnabledRaw(guildId, enabled);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildUpdatesLastAnnouncedVersion(guildId, version) {
  const ok = await setGuildUpdatesLastAnnouncedVersionRaw(guildId, version);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildUpdatesLastAnnouncedCommit(guildId, commitHash) {
  const ok = await setGuildUpdatesLastAnnouncedCommitRaw(guildId, commitHash);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

module.exports = {
  setGuildLanguage,
  getGuildSettings,
  setGuildPrefix,
  setGuildAuditChannel,
  setGuildAuditEnabled,
  setGuildStreamAlertsChannel,
  setGuildStreamAlertsEnabled,
  setGuildStreamAlertEventEnabled,
  setGuildStreamLiveReminderMinutes,
  setGuildEconomyEnabled,
  setGuildEconomyChannel,
  setGuildEconomyExclusive,
  setGuildModuleEnabled,
  setGuildMusicPanelConfig,
  touchGuildMusicPanelActivity,
  setGuildMusicPanelActive,
  setGuildUpdatesChannel,
  setGuildUpdatesAutoEnabled,
  setGuildUpdatesLastAnnouncedVersion,
  setGuildUpdatesLastAnnouncedCommit,
  getGuildSettingsCached,
  invalidateGuildSettingsCache,
};
