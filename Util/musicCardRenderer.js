let musicardLib = null;
let musicardFontsReady = false;
let warnedMissingMusicard = false;

try {
  musicardLib = require('musicard');
} catch {
  musicardLib = null;
}

function escapeRegex(raw) {
  return String(raw || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDisplaySongName(title, author) {
  const rawTitle = String(title || '').trim();
  const rawAuthor = String(author || '').trim();
  if (!rawTitle) return 'Unknown track';
  if (!rawAuthor) return rawTitle;

  const authorPattern = escapeRegex(rawAuthor);
  const prefixRegex = new RegExp(`^${authorPattern}\\s*[-|:•]\\s*`, 'i');
  const topicPrefixRegex = new RegExp(`^${authorPattern}\\s*-\\s*topic\\s*[-|:•]\\s*`, 'i');

  let cleaned = rawTitle.replace(topicPrefixRegex, '').replace(prefixRegex, '').trim();
  if (!cleaned) cleaned = rawTitle;
  return cleaned;
}

async function ensureMusicardFonts() {
  if (!musicardLib || musicardFontsReady) return;
  const init = musicardLib.initializeFonts;
  if (typeof init !== 'function') {
    musicardFontsReady = true;
    return;
  }
  await Promise.resolve(init());
  musicardFontsReady = true;
}

function isNoisyBarStyleLog(args = []) {
  if (!Array.isArray(args) || args.length !== 1) return false;
  const first = args[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return false;

  const keys = Object.keys(first);
  if (!keys.includes('barColor') || !keys.includes('barColorDuo')) return false;
  if (typeof first.barColor !== 'string') return false;
  if (typeof first.barColorDuo !== 'boolean') return false;
  return keys.length <= 2;
}

async function renderMeltWithSuppressedNoise(payload) {
  const originalLog = console.log;
  console.log = (...args) => {
    if (isNoisyBarStyleLog(args)) return;
    return originalLog(...args);
  };

  try {
    return await musicardLib.Melt(payload);
  } finally {
    console.log = originalLog;
  }
}

async function renderMusicCard({
  trackName,
  artistName,
  albumArt,
  fallbackArt,
  timeStart,
  timeEnd,
  progressBar,
  volumeBar,
  isExplicit,
  isLive = false,
} = {}) {
  if (!musicardLib || typeof musicardLib.Melt !== 'function') {
    if (!warnedMissingMusicard) {
      warnedMissingMusicard = true;
      console.warn('[musicCardRenderer] "musicard" no esta instalado; se omite render de card dinamica.');
    }
    return null;
  }

  await ensureMusicardFonts();

  return renderMeltWithSuppressedNoise({
    trackName: String(trackName || 'Unknown Track'),
    artistName: String(artistName || 'Unknown Artist'),
    albumArt: String(albumArt || fallbackArt || ''),
    fallbackArt: String(fallbackArt || albumArt || ''),
    timeAdjust: {
      timeStart: String(timeStart || '0:00'),
      timeEnd: String(timeEnd || (isLive ? 'LIVE' : '0:00')),
    },
    progressBar: Number.isFinite(Number(progressBar)) ? Number(progressBar) : 2,
    volumeBar: Number.isFinite(Number(volumeBar)) ? Number(volumeBar) : 100,
    isExplicit: Boolean(isExplicit),
  });
}

module.exports = {
  getDisplaySongName,
  renderMusicCard,
};
