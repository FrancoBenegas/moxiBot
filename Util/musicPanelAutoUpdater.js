const { MessageFlags } = require('discord.js');
const { musicCard } = require('musicard-quartz');

const moxi = require('../i18n');
const formatDuration = require('./formate');
const { EMOJIS } = require('./emojis');
const { buildActiveMusicSessionContainer } = require('../Components/V2/musicControlsComponent');

const DEFAULT_UPDATE_MS = Number(process.env.MUSIC_PANEL_UPDATE_MS || 2000);
const TIMER_KEY = '__moxiMusicPanelTimer';
const MESSAGE_KEY = '__moxiMusicPanelMessage';
const SIGNATURE_KEY = '__moxiMusicPanelSignature';
const RENDERING_KEY = '__moxiMusicPanelRendering';
const BASE_POSITION_KEY = '__moxiMusicBasePositionMs';
const BASE_AT_KEY = '__moxiMusicBaseAtMs';
const PAUSED_KEY = '__moxiMusicPausedState';
const MUSIC_CARD_THEME = String(process.env.MUSIC_CARD_THEME || 'vector+');
const MUSIC_CARD_COLOR = String(process.env.MUSIC_CARD_COLOR || 'auto');
const MUSIC_CARD_BRIGHTNESS = Number.isFinite(Number(process.env.MUSIC_CARD_BRIGHTNESS))
  ? Number(process.env.MUSIC_CARD_BRIGHTNESS)
  : 50;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getGuildId(player) {
  return player?.guild?.id || player?.guildId || player?.options?.guildId || null;
}

function getPlayerPosition(player, track) {
  const duration = Number(track?.info?.length) || 0;
  const candidates = [
    player?.position,
    player?.currentPosition,
    player?.trackPosition,
    player?.currentTrack?.position,
  ];

  const raw = candidates.find((value) => Number.isFinite(Number(value)));
  const safeRaw = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : null;

  if (safeRaw !== null && safeRaw > 0) {
    const basePos = Number.isFinite(Number(player?.[BASE_POSITION_KEY])) ? Number(player[BASE_POSITION_KEY]) : 0;
    if (Math.abs(safeRaw - basePos) > 1500) {
      player[BASE_POSITION_KEY] = safeRaw;
      player[BASE_AT_KEY] = Date.now();
    }
    if (!duration || track?.info?.isStream) return safeRaw;
    return clampNumber(safeRaw, 0, duration);
  }

  const now = Date.now();
  const basePos = Number.isFinite(Number(player?.[BASE_POSITION_KEY])) ? Number(player[BASE_POSITION_KEY]) : 0;
  const baseAt = Number.isFinite(Number(player?.[BASE_AT_KEY])) ? Number(player[BASE_AT_KEY]) : now;
  const isPaused = Boolean(player?.[PAUSED_KEY] || player?.isPaused);
  const elapsed = isPaused ? 0 : Math.max(0, now - baseAt);
  const computed = Math.max(0, basePos + elapsed);

  if (!duration || track?.info?.isStream) return computed;
  return clampNumber(computed, 0, duration);
}

function initMusicPanelTimeline(player, startPositionMs = 0) {
  if (!player) return;
  player[BASE_POSITION_KEY] = Math.max(0, Number(startPositionMs) || 0);
  player[BASE_AT_KEY] = Date.now();
  player[PAUSED_KEY] = Boolean(player?.isPaused);
}

function setMusicPanelPaused(player, paused) {
  if (!player) return;
  const wasPaused = Boolean(player?.[PAUSED_KEY]);
  const nextPaused = Boolean(paused);
  if (wasPaused === nextPaused) return;

  const now = Date.now();
  const basePos = Number.isFinite(Number(player?.[BASE_POSITION_KEY])) ? Number(player[BASE_POSITION_KEY]) : 0;
  const baseAt = Number.isFinite(Number(player?.[BASE_AT_KEY])) ? Number(player[BASE_AT_KEY]) : now;

  if (nextPaused) {
    player[BASE_POSITION_KEY] = Math.max(0, basePos + Math.max(0, now - baseAt));
  }

  player[BASE_AT_KEY] = now;
  player[PAUSED_KEY] = nextPaused;
}

function seekMusicPanelTimeline(player, positionMs) {
  if (!player) return;
  player[BASE_POSITION_KEY] = Math.max(0, Number(positionMs) || 0);
  player[BASE_AT_KEY] = Date.now();
}

function toCardProgress(position, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 2;
  const pct = Math.round((position / duration) * 100);
  return clampNumber(pct, 2, 100);
}

async function buildDynamicMusicCard({ player, track, sourceImageUrl, position }) {
  const duration = Number(track?.info?.length) || 0;
  if (!sourceImageUrl || !duration || track?.info?.isStream) return null;

  const card = new musicCard()
    .setName(track.info.title)
    .setAuthor(track.info.author)
    .setColor(MUSIC_CARD_COLOR)
    .setTheme(MUSIC_CARD_THEME)
    .setBrightness(MUSIC_CARD_BRIGHTNESS)
    .setProgress(toCardProgress(position, duration))
    .setStartTime(formatDuration(position))
    .setEndTime(formatDuration(duration))
    .setThumbnail(sourceImageUrl);

  try {
    const buffer = await card.build();
    if (!Buffer.isBuffer(buffer) || buffer.length <= 0) return null;
    const fileName = `moxi_live_${Date.now()}.png`;
    return {
      attachment: { attachment: buffer, name: fileName },
      imageUrl: `attachment://${fileName}`,
    };
  } catch {
    return null;
  }
}

async function buildActiveMusicPanelData({ player, lang, imageUrl, extraLine = '' } = {}) {
  const track = player?.currentTrack;
  if (!track?.info) return null;

  const position = getPlayerPosition(player, track);
  const duration = Number(track.info.length) || 0;
  const requester = track?.info?.requester?.tag || track?.info?.requester?.username || 'Moxi Autoplay';
  const title = `${EMOJIS.nowPlayingAnim} ${moxi.translate('MUSIC_NOW_PLAYING', lang)} [${track.info.title}](${track.info.uri})`;

  const infoLines = [
    `**${moxi.translate('MUSIC_QUEUE_COUNT', lang)}** \`${player.queue.length}\``,
    `**${moxi.translate('MUSIC_REQUESTED_BY', lang)}** \`${requester}\``,
  ];

  if (track.info.isStream) {
    infoLines.push(`${EMOJIS.hourglass} \`LIVE\``);
  }

  if (player.isPaused) infoLines.push('⏸️');
  if (extraLine) infoLines.push(String(extraLine));

  return {
    title,
    info: infoLines.join('\n'),
    imageUrl: imageUrl || null,
    footerText: `> ${EMOJIS.studioAnim} _**Moxi Studios**_ `,
    positionBucket: track.info.isStream ? 'live' : Math.floor(position / 1000),
    trackId: track.info.identifier || track.info.uri || track.info.title,
  };
}

function getMusicPanelMessage(player) {
  return player?.[MESSAGE_KEY] || null;
}

function setMusicPanelMessage(player, message) {
  if (!player) return;
  player[MESSAGE_KEY] = message || null;
}

function stopMusicPanelAutoUpdate(player) {
  if (!player) return;
  if (player[TIMER_KEY]) {
    clearInterval(player[TIMER_KEY]);
    player[TIMER_KEY] = null;
  }
  player[SIGNATURE_KEY] = null;
  player[RENDERING_KEY] = false;
}

async function renderActiveMusicPanel({ client, player, message, extraLine = '', force = false } = {}) {
  let targetMessage = message || getMusicPanelMessage(player);
  if (!player || !player.currentTrack?.info || !targetMessage) return null;
  if (player[RENDERING_KEY]) return null;

  const guildId = getGuildId(player);
  const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
  const previousSession = (typeof player.get === 'function') ? await player.get('lastSessionData').catch(() => null) : null;
  const sourceImageUrl =
    previousSession?.artworkSourceUrl ||
    previousSession?.imageUrl ||
    targetMessage.attachments?.first?.()?.url ||
    player.currentTrack?.info?.image ||
    player.currentTrack?.info?.artworkUrl ||
    null;
  const track = player.currentTrack;
  const position = getPlayerPosition(player, track);
  const dynamicCard = await buildDynamicMusicCard({
    player,
    track,
    sourceImageUrl,
    position,
  });
  const panel = await buildActiveMusicPanelData({
    player,
    lang,
    imageUrl: dynamicCard?.imageUrl || sourceImageUrl,
    extraLine,
  });
  if (!panel) return null;

  const signature = [
    panel.trackId,
    panel.positionBucket,
    player.queue.length,
    player.isPaused ? 'paused' : 'playing',
    extraLine,
  ].join('|');

  if (!force && player[SIGNATURE_KEY] === signature) return panel;

  player[RENDERING_KEY] = true;
  try {
    const container = buildActiveMusicSessionContainer({
      title: panel.title,
      info: panel.info,
      imageUrl: panel.imageUrl,
      footerText: panel.footerText,
    });

    const basePayload = { components: [container] };

    if (dynamicCard?.attachment) {
      try {
        await targetMessage.edit({
          ...basePayload,
          files: [dynamicCard.attachment],
        });
      } catch {
        // Fallback fuerte: si Discord no permite editar con archivo, reemplazamos el panel.
        try {
          const replacement = await targetMessage.channel.send({
            ...basePayload,
            files: [dynamicCard.attachment],
          });
          await targetMessage.delete().catch(() => null);
          targetMessage = replacement;
          setMusicPanelMessage(player, replacement);
          if (client?.previousMessage?.id && client.previousMessage.id !== replacement.id) {
            client.previousMessage = replacement;
          }
        } catch {
          await targetMessage.edit(basePayload);
        }
      }
    } else {
      await targetMessage.edit(basePayload);
    }

    player[SIGNATURE_KEY] = signature;
    if (typeof player.set === 'function') {
      await player.set('lastSessionData', {
        title: panel.title,
        info: panel.info,
        imageUrl: panel.imageUrl,
        artworkSourceUrl: sourceImageUrl,
      }).catch(() => null);
    }
    return panel;
  } catch (error) {
    const msg = String(error?.message || error || 'unknown error');
    // Solo apagamos el updater si el mensaje ya no existe o no se puede editar de forma permanente.
    const permanent = /Unknown Message|Missing Access|Missing Permissions/i.test(msg);
    if (permanent) stopMusicPanelAutoUpdate(player);
    // Errores transitorios no deben detener las actualizaciones siguientes.
    return null;
  } finally {
    player[RENDERING_KEY] = false;
  }
}

function startMusicPanelAutoUpdate(client, player, message) {
  if (!player || !message) return;
  stopMusicPanelAutoUpdate(player);
  setMusicPanelMessage(player, message);

  const intervalMs = Number.isFinite(DEFAULT_UPDATE_MS) && DEFAULT_UPDATE_MS >= 1500
    ? DEFAULT_UPDATE_MS
    : 2000;

  const timer = setInterval(() => {
    if (!player?.currentTrack?.info) {
      stopMusicPanelAutoUpdate(player);
      return;
    }
    void renderActiveMusicPanel({ client, player });
  }, intervalMs);

  timer.unref?.();
  player[TIMER_KEY] = timer;
}

module.exports = {
  buildActiveMusicPanelData,
  getMusicPanelMessage,
  initMusicPanelTimeline,
  seekMusicPanelTimeline,
  setMusicPanelPaused,
  setMusicPanelMessage,
  renderActiveMusicPanel,
  startMusicPanelAutoUpdate,
  stopMusicPanelAutoUpdate,
};