const { ContainerBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { ensureUserAndBotPerms } = require('./_utils');
const { getGuildSettings, setGuildAutoPurgeConfig } = require('../../Models/GuildSettings');
const { runAutoPurgeCycle } = require('../../Util/autoPurge');
const { normalizeDiscordId } = require('../../Util/idGuards');

function panel(title, body) {
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents((c) => c.setContent(`# ${title}`))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((c) => c.setContent(body));

  return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function collectChannelIds(message, args) {
  const ids = new Set();
  const mentionIds = message.mentions?.channels ? [...message.mentions.channels.keys()] : [];
  for (const id of mentionIds) {
    const clean = normalizeDiscordId(id);
    if (clean) ids.add(clean);
  }

  for (const token of args) {
    const raw = String(token || '').trim();
    if (!raw) continue;
    const clean = normalizeDiscordId(raw.replace(/[<#>]/g, ''));
    if (clean) ids.add(clean);
  }

  return [...ids];
}

module.exports = {
  name: 'autopurge',
  alias: ['apurge', 'purgeauto', 'autoclear'],
  description: 'Configura limpieza automática cada 24h por canales elegidos.',
  usage: 'autopurge status | autopurge on | autopurge off | autopurge canales #chat #memes | autopurge add #canal | autopurge remove #canal | autopurge run',
  Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang) || 'Moderation',
  cooldown: 3,
  permissions: { User: ['Administrator'] },

  async execute(Moxi, message, args) {
    if (!message.guild) {
      return message.reply(panel('AutoPurge', `${EMOJIS.cross} Este comando solo funciona en servidores.`));
    }

    const guildId = message.guild.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const perm = await ensureUserAndBotPerms({
      message,
      lang,
      userPermBits: PermissionsBitField.Flags.ManageGuild,
      userPermKeys: ['ManageGuild'],
      botPermBits: PermissionsBitField.Flags.ManageMessages,
      botPermKeys: ['ManageMessages'],
    });
    if (!perm.ok) return message.reply(panel('AutoPurge', `${EMOJIS.cross} ${perm.reply}`));

    const sub = String(args[0] || 'status').toLowerCase();
    const settings = await getGuildSettings(guildId);
    const currentChannels = Array.isArray(settings.AutoPurgeChannels)
      ? settings.AutoPurgeChannels.map((id) => normalizeDiscordId(id)).filter(Boolean)
      : [];

    if (sub === 'on' || sub === 'enable') {
      await setGuildAutoPurgeConfig(guildId, { enabled: true, intervalHours: 24 });
      return message.reply(panel('AutoPurge', `${EMOJIS.tick} AutoPurge activado. Se ejecutará cada 24 horas.`));
    }

    if (sub === 'off' || sub === 'disable') {
      await setGuildAutoPurgeConfig(guildId, { enabled: false });
      return message.reply(panel('AutoPurge', `${EMOJIS.tick} AutoPurge desactivado.`));
    }

    if (sub === 'canales' || sub === 'channels' || sub === 'set') {
      const channels = collectChannelIds(message, args.slice(1));
      if (!channels.length) {
        return message.reply(panel('AutoPurge', `${EMOJIS.cross} Indica al menos un canal. Ejemplo: \`autopurge canales #general #chat\``));
      }
      await setGuildAutoPurgeConfig(guildId, { channels });
      return message.reply(panel('AutoPurge', `${EMOJIS.tick} Canales configurados:\n${channels.map((id) => `<#${id}>`).join(', ')}`));
    }

    if (sub === 'add' || sub === 'agregar') {
      const channels = collectChannelIds(message, args.slice(1));
      if (!channels.length) {
        return message.reply(panel('AutoPurge', `${EMOJIS.cross} Indica un canal. Ejemplo: \`autopurge add #general\``));
      }
      const merged = [...new Set([...currentChannels, ...channels])];
      await setGuildAutoPurgeConfig(guildId, { channels: merged });
      return message.reply(panel('AutoPurge', `${EMOJIS.tick} Canales añadidos.\n${merged.map((id) => `<#${id}>`).join(', ')}`));
    }

    if (sub === 'remove' || sub === 'rm' || sub === 'quitar') {
      const channels = collectChannelIds(message, args.slice(1));
      if (!channels.length) {
        return message.reply(panel('AutoPurge', `${EMOJIS.cross} Indica un canal. Ejemplo: \`autopurge remove #general\``));
      }
      const next = currentChannels.filter((id) => !channels.includes(id));
      await setGuildAutoPurgeConfig(guildId, { channels: next });
      return message.reply(panel('AutoPurge', `${EMOJIS.tick} Canales restantes:\n${next.length ? next.map((id) => `<#${id}>`).join(', ') : 'ninguno'}`));
    }

    if (sub === 'run' || sub === 'now') {
      await runAutoPurgeCycle(Moxi);
      return message.reply(panel('AutoPurge', `${EMOJIS.tick} Ciclo ejecutado manualmente.`));
    }

    const enabled = !!settings.AutoPurgeEnabled;
    const channelsText = currentChannels.length ? currentChannels.map((id) => `<#${id}>`).join(', ') : 'ninguno';
    const lastRun = settings.AutoPurgeLastRunAt ? new Date(settings.AutoPurgeLastRunAt) : null;
    const lastRunText = lastRun && Number.isFinite(lastRun.getTime()) ? `<t:${Math.floor(lastRun.getTime() / 1000)}:R>` : 'nunca';

    return message.reply(
      panel(
        'AutoPurge',
        `Estado: **${enabled ? 'activado' : 'desactivado'}**\nIntervalo: **24h**\nCanales: ${channelsText}\nÚltima ejecución: **${lastRunText}**\n\nUso: \`${this.usage}\``
      )
    );
  },
};
