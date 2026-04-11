const {
  PermissionFlagsBits,
  ContainerBuilder,
  MessageFlags,
} = require('discord.js');

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { Bot } = require('../../Config');
const moxi = require('../../i18n');
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

function buildPanel({ title, body }) {
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents(c => c.setContent(`# ${title}`))
    .addSeparatorComponents(s => s.setDivider(true))
    .addTextDisplayComponents(c => c.setContent(body));
  return { content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 };
}

function formatPlatform(platform) {
  if (platform === 'twitch') return 'Twitch';
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'kick') return 'Kick';
  return platform;
}

module.exports = {
  cooldown: 5,
  Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ADMIN', lang),

  data: new SlashCommandBuilder()
    .setName('streamalerts')
    .setDescription('Configura avisos cuando un canal entra en directo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setchannel')
        .setDescription('Canal donde se enviarán las alertas')
        .addChannelOption(o => o.setName('canal').setDescription('Canal destino').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Añadir un canal a vigilar')
        .addStringOption(o => o.setName('plataforma').setDescription('twitch, youtube o kick').setRequired(true)
          .addChoices(
            { name: 'Twitch', value: 'twitch' },
            { name: 'YouTube', value: 'youtube' },
            { name: 'Kick', value: 'kick' },
          ))
        .addStringOption(o => o.setName('usuario').setDescription('Nombre, @handle o URL del canal').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Quitar un canal de la lista')
        .addStringOption(o => o.setName('plataforma').setDescription('twitch, youtube o kick').setRequired(true)
          .addChoices(
            { name: 'Twitch', value: 'twitch' },
            { name: 'YouTube', value: 'youtube' },
            { name: 'Kick', value: 'kick' },
          ))
        .addStringOption(o => o.setName('usuario').setDescription('Nombre, @handle o URL del canal').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('check')
        .setDescription('Comprobar ahora mismo el estado de un canal')
        .addStringOption(o => o.setName('plataforma').setDescription('twitch, youtube o kick').setRequired(true)
          .addChoices(
            { name: 'Twitch', value: 'twitch' },
            { name: 'YouTube', value: 'youtube' },
            { name: 'Kick', value: 'kick' },
          ))
        .addStringOption(o => o.setName('usuario').setDescription('Nombre, @handle o URL del canal').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Ver suscripciones registradas')
    )
    .addSubcommand(sub =>
      sub
        .setName('on')
        .setDescription('Activar alertas')
    )
    .addSubcommand(sub =>
      sub
        .setName('off')
        .setDescription('Desactivar alertas')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Ver el estado actual')
    ),

  async run(Moxi, interaction) {
    const guildId = interaction.guildId || interaction.guild?.id;
    await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    if (!interaction.guild) {
      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: `${EMOJIS.cross} Este comando solo funciona dentro de un servidor.`,
      }));
    }

    try {
      await ensureMongoConnection();
    } catch (error) {
      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: `${EMOJIS.cross} MongoDB no está disponible: ${error?.message || error}`,
      }));
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'setchannel') {
      const channel = interaction.options.getChannel('canal', true);
      await setGuildStreamAlertsChannel(guildId, channel.id);
      await setGuildSubscriptionChannel(guildId, channel.id);
      invalidateGuildSettingsCache(guildId);

      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: `${EMOJIS.tick} Canal configurado en <#${channel.id}>.`,
      }));
    }

    if (sub === 'on') {
      await setGuildStreamAlertsEnabled(guildId, true);
      invalidateGuildSettingsCache(guildId);
      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: `${EMOJIS.tick} Alertas de stream activadas.`,
      }));
    }

    if (sub === 'off') {
      await setGuildStreamAlertsEnabled(guildId, false);
      invalidateGuildSettingsCache(guildId);
      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: `${EMOJIS.tick} Alertas de stream desactivadas.`,
      }));
    }

    if (sub === 'status') {
      const settings = await getGuildSettingsCached(guildId);
      const channelText = settings?.StreamAlertsChannelId ? `<#${settings.StreamAlertsChannelId}>` : '-';
      const enabled = typeof settings?.StreamAlertsEnabled === 'boolean' ? settings.StreamAlertsEnabled : true;
      const subscriptions = await listGuildSubscriptions(guildId);
      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: [
          `${EMOJIS.info || 'ℹ️'} Estado: **${enabled ? 'activo' : 'apagado'}**`,
          `${EMOJIS.channel || '#'} Canal: ${channelText}`,
          `${EMOJIS.folder || '📁'} Suscripciones: **${subscriptions.length}**`,
          '',
          'Plataformas soportadas: Twitch, YouTube, Kick.',
        ].join('\n'),
      }));
    }

    if (sub === 'list') {
      const subscriptions = await listGuildSubscriptions(guildId);
      if (!subscriptions.length) {
        return interaction.reply(buildPanel({
          title: 'Stream Alerts',
          body: `${EMOJIS.cross} No hay suscripciones registradas.`,
        }));
      }

      const lines = subscriptions.slice(0, 20).map((item) => {
        const status = item.lastKnownLive ? 'LIVE' : 'offline';
        const errorText = item.lastError ? ` | error: ${item.lastError}` : '';
        return `- ${formatPlatform(item.platform)} | ${item.handle} | ${status}${errorText}`;
      });
      if (subscriptions.length > 20) lines.push(`- ...y ${subscriptions.length - 20} más`);

      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: lines.join('\n'),
      }));
    }

    const platform = normalizePlatform(interaction.options.getString('plataforma', true));
    const rawUser = interaction.options.getString('usuario', true);
    const normalizedUser = normalizeHandle(rawUser, platform);
    const { provider } = getStreamProvider(platform);

    if (sub === 'check') {
      try {
        const resolved = await provider.resolve(normalizedUser);
        const live = await provider.getLiveStatus({
          platform,
          handle: resolved.handle,
          externalId: resolved.externalId,
          displayName: resolved.displayName,
          profileUrl: resolved.profileUrl,
        });

        return interaction.reply(buildPanel({
          title: 'Stream Alerts',
          body: live.isLive
            ? `${EMOJIS.live || '🔴'} **LIVE** ${resolved.displayName || resolved.handle}\n${live.url || resolved.profileUrl}\n${live.title || 'Sin título'}`
            : `${EMOJIS.tick} ${resolved.displayName || resolved.handle} está offline ahora mismo.`,
        }));
      } catch (error) {
        return interaction.reply(buildPanel({
          title: 'Stream Alerts',
          body: `${EMOJIS.cross} ${error?.message || error}`,
        }));
      }
    }

    if (sub === 'add') {
      const settings = await getGuildSettingsCached(guildId);
      const channelId = settings?.StreamAlertsChannelId ? String(settings.StreamAlertsChannelId) : '';
      if (!channelId) {
        return interaction.reply(buildPanel({
          title: 'Stream Alerts',
          body: `${EMOJIS.cross} Primero configura el canal con \`/streamalerts setchannel\`.`,
        }));
      }

      try {
        const resolved = await provider.resolve(normalizedUser);
        const saved = await upsertSubscription({
          guildId,
          channelId,
          platform,
          handle: resolved.handle,
          displayName: resolved.displayName,
          externalId: resolved.externalId,
          profileUrl: resolved.profileUrl,
          createdBy: interaction.user.id,
        });

        return interaction.reply(buildPanel({
          title: 'Stream Alerts',
          body: `${EMOJIS.tick} Registrado **${saved.displayName || saved.handle}** en ${formatPlatform(saved.platform)}.\nCanal: <#${saved.channelId}>`,
        }));
      } catch (error) {
        return interaction.reply(buildPanel({
          title: 'Stream Alerts',
          body: `${EMOJIS.cross} ${error?.message || error}`,
        }));
      }
    }

    if (sub === 'remove') {
      let externalId = null;
      try {
        const resolved = await provider.resolve(normalizedUser);
        externalId = resolved.externalId || null;
      } catch {
        externalId = null;
      }
      const removed = await removeSubscription({ guildId, platform, handle: normalizedUser, externalId });
      return interaction.reply(buildPanel({
        title: 'Stream Alerts',
        body: removed
          ? `${EMOJIS.tick} Suscripción eliminada: ${formatPlatform(platform)} / ${normalizedUser}`
          : `${EMOJIS.cross} No encontré esa suscripción.`,
      }));
    }

    return interaction.reply(buildPanel({
      title: 'Stream Alerts',
      body: `${EMOJIS.cross} Subcomando no soportado.`,
    }));
  },
};
