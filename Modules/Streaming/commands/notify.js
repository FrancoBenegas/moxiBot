const { EmbedBuilder } = require('discord.js');
const { Bot } = require('../../../Config');
const { EMOJIS } = require('../../../Util/emojis');
const { ensureMongoConnection } = require('../../../Util/mongoConnect');
const {
  getGuildSettingsCached,
  invalidateGuildSettingsCache,
  setGuildStreamAlertEventEnabled,
  setGuildStreamLiveReminderMinutes,
} = require('../../../Util/guildSettings');

function buildPanel({ title, body }) {
  const embed = new EmbedBuilder()
    .setColor(Bot.AccentColor)
    .setTitle(title)
    .setDescription(body);
  return { embeds: [embed] };
}

function formatBool(value) {
  return value ? 'ON' : 'OFF';
}

module.exports = {
  name: 'streamnotify',
  alias: ['streamnoti', 'notifystream'],
  usage: 'streamnotify status | streamnotify <start|live|end> <on|off> | streamnotify interval <minutos>',
  description: () => 'Configura avisos de inicio, recordatorio live y final de stream.',
  Category: () => `${EMOJIS.redCircle || '🔴'} Streaming`,
  permissions: { User: ['Administrator'] },
  cooldown: 5,

  async execute(_Moxi, message, args) {
    if (!message.guild) {
      return message.reply(buildPanel({
        title: 'Stream Notify',
        body: `${EMOJIS.cross} Este comando solo funciona dentro de un servidor.`,
      }));
    }

    try {
      await ensureMongoConnection();
    } catch (error) {
      return message.reply(buildPanel({
        title: 'Stream Notify',
        body: `${EMOJIS.cross} MongoDB no esta disponible: ${error?.message || error}`,
      }));
    }

    const guildId = message.guild.id;
    const sub = String(args[0] || 'status').trim().toLowerCase();

    if (sub === 'interval') {
      const minutes = Number.parseInt(String(args[1] || '').trim(), 10);
      if (!Number.isFinite(minutes) || minutes < 5) {
        return message.reply(buildPanel({
          title: 'Stream Notify',
          body: `${EMOJIS.cross} Uso: \`.streamnotify interval <minutos>\` (minimo 5)`,
        }));
      }
      const ok = await setGuildStreamLiveReminderMinutes(guildId, minutes);
      invalidateGuildSettingsCache(guildId);
      return message.reply(buildPanel({
        title: 'Stream Notify',
        body: ok
          ? `${EMOJIS.tick} Recordatorio LIVE configurado cada **${minutes}** minutos.`
          : `${EMOJIS.cross} No pude guardar el intervalo.`,
      }));
    }

    if (['start', 'live', 'end'].includes(sub)) {
      const rawToggle = String(args[1] || '').trim().toLowerCase();
      const enabled = ['on', 'true', '1', 'si', 'enable'].includes(rawToggle);
      const disabled = ['off', 'false', '0', 'no', 'disable'].includes(rawToggle);
      if (!enabled && !disabled) {
        return message.reply(buildPanel({
          title: 'Stream Notify',
          body: `${EMOJIS.cross} Uso: \`.streamnotify ${sub} <on|off>\``,
        }));
      }

      const ok = await setGuildStreamAlertEventEnabled(guildId, sub, enabled);
      invalidateGuildSettingsCache(guildId);
      return message.reply(buildPanel({
        title: 'Stream Notify',
        body: ok
          ? `${EMOJIS.tick} Aviso **${sub}** en **${enabled ? 'ON' : 'OFF'}**.`
          : `${EMOJIS.cross} No pude guardar el ajuste.`,
      }));
    }

    const settings = await getGuildSettingsCached(guildId);
    const notifyStart = typeof settings?.StreamAlertsNotifyStart === 'boolean' ? settings.StreamAlertsNotifyStart : true;
    const notifyLive = typeof settings?.StreamAlertsNotifyLive === 'boolean' ? settings.StreamAlertsNotifyLive : false;
    const notifyEnd = typeof settings?.StreamAlertsNotifyEnd === 'boolean' ? settings.StreamAlertsNotifyEnd : true;
    const liveReminderMinutes = Number.parseInt(String(settings?.StreamAlertsLiveReminderMinutes || ''), 10) || 60;

    return message.reply(buildPanel({
      title: 'Stream Notify',
      body: [
        `${EMOJIS.redCircle || '🔴'} start: **${formatBool(notifyStart)}**`,
        `${EMOJIS.redCircle || '🔴'} live: **${formatBool(notifyLive)}**`,
        `${EMOJIS.redCircle || '🔴'} end: **${formatBool(notifyEnd)}**`,
        `${EMOJIS.hourglass || '⏳'} intervalo live: **${liveReminderMinutes} min**`,
        '',
        'Ejemplos:',
        '`.streamnotify start on`',
        '`.streamnotify live off`',
        '`.streamnotify end on`',
        '`.streamnotify interval 60`',
      ].join('\n'),
    }));
  },
};
