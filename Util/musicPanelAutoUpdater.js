const { MessageFlags } = require('discord.js');

const moxi = require('../i18n');
const formatDuration = require('./formate');
const { EMOJIS } = require('./emojis');
const { formatStudioFooter } = require('./seasonBrand');
const { buildActiveMusicSessionContainer } = require('../Components/V2/musicControlsComponent');
const { getDisplaySongName, renderMusicCard } = require('./musicCardRenderer');

const DEFAULT_UPDATE_MS = Number(process.env.MUSIC_PANEL_UPDATE_MS || 2000);
const TIMER_KEY = '__moxiMusicPanelTimer';
const MESSAGE_KEY = '__moxiMusicPanelMessage';
const SIGNATURE_KEY = '__moxiMusicPanelSignature';
const RENDERING_KEY = '__moxiMusicPanelRendering';
const BASE_POSITION_KEY = '__moxiMusicBasePositionMs';
const BASE_AT_KEY = '__moxiMusicBaseAtMs';
const PAUSED_KEY = '__moxiMusicPausedState';
const MUSIC_CARD_FALLBACK_IMG = String(process.env.MUSIC_FALLBACK_IMAGE_URL || '').trim();
const MAX_PLAYER_VOLUME = Number.isFinite(Number(process.env.MUSIC_MAX_VOLUME))
  ? Math.max(1, Number(process.env.MUSIC_MAX_VOLUME))
  : 150;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getGuildId(player) {
  return player?.guild?.id || player?.guildId || player?.options?.guildId || null;
}

function isPlayerPaused(player) {
  // En algunos wrappers `isPaused` puede ser función; no la evaluamos aquí
  // porque `Boolean(function)` sería true y congelaría el timeline en 00:00.
  if (typeof player?.isPaused === 'boolean') return player.isPaused;
  if (typeof player?.paused === 'boolean') return player.paused;
  if (typeof player?.isPlaying === 'boolean') return !player.isPlaying;
  return Boolean(player?.[PAUSED_KEY]);
}

function getPlayerPosition(player, track) {
  const duration = Number(track?.info?.length) || 0;
  const candidates = [
    player?.position,
    player?.currentPosition,
    player?.trackPosition,
    player?.currentTrack?.position,
  ];

  // Ignoramos 0 para no quedarnos clavados en origen cuando el nodo no reporta posición aún.
  const raw = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
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
  const isPaused = isPlayerPaused(player);
  const elapsed = isPaused ? 0 : Math.max(0, now - baseAt);
  const computed = Math.max(0, basePos + elapsed);

  // Mantener timeline caliente mientras reproduce evita quedarse clavado en 00:00
  // cuando el nodo no reporta `position` de forma continua.
  if (!isPaused) {
    player[BASE_POSITION_KEY] = computed;
    player[BASE_AT_KEY] = now;
  }

  if (!duration || track?.info?.isStream) return computed;
  return clampNumber(computed, 0, duration);
}

function initMusicPanelTimeline(player, startPositionMs = 0) {
  if (!player) return;
  player[BASE_POSITION_KEY] = Math.max(0, Number(startPositionMs) || 0);
  player[BASE_AT_KEY] = Date.now();
  player[PAUSED_KEY] = isPlayerPaused(player);
}

function setMusicPanelPaused(player, paused) {
  if (!player) return;
  const wasPaused = isPlayerPaused(player);
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

function getProgressMilestoneBucket(position, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 'unknown';

  const ratio = clampNumber(position / duration, 0, 1);
  if (ratio < 0.5) return 'first-half';
  if (ratio < 0.99) return 'second-half';
  return 'ending';
}

function getPlayerVolumePercent(player) {
  const candidates = [player?.volume, player?.filters?.volume, player?.currentVolume];
  const found = candidates.find((v) => Number.isFinite(Number(v)));
  if (!Number.isFinite(Number(found))) return 67;

  const playerVolume = Math.max(0, Number(found));
  const normalized = Math.round((playerVolume / MAX_PLAYER_VOLUME) * 100);
  return clampNumber(normalized, 0, 100);
}

function getPlayerRawVolume(player) {
  const candidates = [player?.volume, player?.filters?.volume, player?.currentVolume];
  const found = candidates.find((v) => Number.isFinite(Number(v)));
  if (!Number.isFinite(Number(found))) return 100;
  return Math.max(0, Math.round(Number(found)));
}

function getTrackRequesterDisplay(track) {
  const requester = track?.info?.requester || track?.requester || null;
  const requesterId =
    requester?.id ||
    track?.info?.requesterId ||
    track?.requesterId ||
    null;

  if (requesterId) return `<@${requesterId}>`;

  const requesterName =
    requester?.globalName ||
    requester?.displayName ||
    requester?.username ||
    requester?.tag ||
    null;

  if (requesterName) return String(requesterName);
  return 'Unknown';
}

function toBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'si', 'explicit', 'clean=false'].includes(normalized);
  }
  return false;
}

function hasExplicitMarkerInTitle(title) {
  const t = String(title || '').trim().toLowerCase();
  if (!t) return false;

  // Modo estricto: solo marcadores explícitos canónicos.
  if (/\[e\]|\(e\)|🅴/.test(t)) return true;
  return false;
}

function isTrackExplicit(track) {
  const candidates = [
    track?.info?.isExplicit,
    track?.info?.explicit,
    track?.pluginInfo?.isExplicit,
    track?.pluginInfo?.explicit,
  ];
  if (candidates.some((value) => toBooleanFlag(value))) return true;
  return hasExplicitMarkerInTitle(track?.info?.title);
}

async function buildDynamicMusicCard({ player, track, sourceImageUrl, position }) {
  const duration = Number(track?.info?.length) || 0;
  if (!sourceImageUrl || !duration || track?.info?.isStream) return null;

  try {
    const buffer = await renderMusicCard({
      trackName: getDisplaySongName(track?.info?.title, track?.info?.author),
      artistName: String(track?.info?.author || 'Unknown Artist'),
      albumArt: sourceImageUrl,
      fallbackArt: MUSIC_CARD_FALLBACK_IMG || sourceImageUrl,
      timeStart: formatDuration(position),
      timeEnd: formatDuration(duration),
      progressBar: toCardProgress(position, duration),
      volumeBar: getPlayerVolumePercent(player),
      isExplicit: isTrackExplicit(track),
      isLive: false,
    });

    if (!Buffer.isBuffer(buffer) || buffer.length <= 0) return null;
    const fileName = 'moxi_live.png';
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
  const volume = getPlayerVolumePercent(player);
  const rawVolume = getPlayerRawVolume(player);
  const title = `${EMOJIS.nowPlayingAnim} ${moxi.translate('MUSIC_NOW_PLAYING', lang)} [${track.info.title}](${track.info.uri})`;
  const requestedByLabel = moxi.translate('MUSIC_REQUESTED_BY', lang) || 'Solicitado por:';
  const requestedByValue = getTrackRequesterDisplay(track);

  const infoLines = [
    `**${requestedByLabel}** ${requestedByValue}`,
    `**${moxi.translate('MUSIC_QUEUE_COUNT', lang)}** \`${player.queue.length}\``,
  ];

  if (track.info.isStream) {
    infoLines.push(`${EMOJIS.hourglass} \`LIVE\``);
  }

  if (isPlayerPaused(player)) infoLines.push('⏸️');
  if (extraLine) infoLines.push(String(extraLine));

  return {
    title,
    info: infoLines.join('\n'),
    imageUrl: imageUrl || null,
    footerText: formatStudioFooter(),
    positionBucket: track.info.isStream ? 'live' : getProgressMilestoneBucket(position, duration),
    volumeBucket: volume,
    rawVolumeBucket: rawVolume,
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

async function safePlayerGet(player, key) {
  if (!player || typeof player.get !== 'function') return null;
  try {
    return await Promise.resolve(player.get(key));
  } catch {
    return null;
  }
}

async function safePlayerSet(player, key, value) {
  if (!player || typeof player.set !== 'function') return;
  try {
    await Promise.resolve(player.set(key, value));
  } catch {
    // ignore
  }
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
  const previousSession = await safePlayerGet(player, 'lastSessionData');
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
    panel.volumeBucket,
    panel.rawVolumeBucket,
    player.queue.length,
    isPlayerPaused(player) ? 'paused' : 'playing',
    extraLine,
  ].join('|');

  if (!force && player[SIGNATURE_KEY] === signature) return panel;

  player[RENDERING_KEY] = true;
  try {
    const buildPayload = (imageUrl) => {
      const container = buildActiveMusicSessionContainer({
        title: panel.title,
        info: panel.info,
        imageUrl,
        footerText: panel.footerText,
      });
      return { components: [container] };
    };

    const basePayload = buildPayload(panel.imageUrl);

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
    await safePlayerSet(player, 'lastSessionData', {
      title: panel.title,
      info: panel.info,
      imageUrl: panel.imageUrl,
      artworkSourceUrl: sourceImageUrl,
    });
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

  const intervalMs = Number.isFinite(DEFAULT_UPDATE_MS) && DEFAULT_UPDATE_MS >= 1000
    ? DEFAULT_UPDATE_MS
    : 2000;

  const timer = setInterval(() => {
    if (!player?.currentTrack?.info) {
      stopMusicPanelAutoUpdate(player);
      return;
    }
    // Actualizamos por hitos (mitad/final) en lugar de cada tick para evitar parpadeo.
    void renderActiveMusicPanel({ client, player, force: false });
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