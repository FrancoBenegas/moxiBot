const axios = require('axios');
const { normalizeDbText } = require('./idGuards');
const { normalizeHandle, normalizePlatform } = require('./streamAlertsStorage');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; MoxiBot/1.0; +https://discord.com)',
  'Accept-Language': 'en-US,en;q=0.9',
};

let twitchTokenCache = {
  accessToken: null,
  expiresAt: 0,
};

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseIsoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

async function getTwitchAccessToken() {
  if (twitchTokenCache.accessToken && twitchTokenCache.expiresAt > Date.now() + 30_000) {
    return twitchTokenCache.accessToken;
  }

  const clientId = String(process.env.TWITCH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.TWITCH_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('Faltan TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const response = await axios.post('https://id.twitch.tv/oauth2/token', params.toString(), {
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15_000,
  });

  twitchTokenCache = {
    accessToken: response.data.access_token,
    expiresAt: Date.now() + (Number(response.data.expires_in || 0) * 1000),
  };

  return twitchTokenCache.accessToken;
}

async function twitchApiGet(path, params) {
  const clientId = String(process.env.TWITCH_CLIENT_ID || '').trim();
  const token = await getTwitchAccessToken();
  const response = await axios.get(`https://api.twitch.tv/helix/${path}`, {
    params,
    headers: {
      ...DEFAULT_HEADERS,
      'Client-Id': clientId,
      'Authorization': `Bearer ${token}`,
    },
    timeout: 15_000,
  });
  return response.data;
}

async function resolveTwitch(handleInput) {
  const handle = normalizeHandle(handleInput, 'twitch');
  const data = await twitchApiGet('users', { login: handle });
  const user = Array.isArray(data?.data) ? data.data[0] : null;
  if (!user) throw new Error('No encontré ese canal de Twitch.');
  return {
    handle: String(user.login || handle).toLowerCase(),
    externalId: String(user.id),
    displayName: normalizeDbText(user.display_name, { maxLen: 120, fallback: user.login }),
    profileUrl: `https://twitch.tv/${user.login}`,
  };
}

async function getTwitchLiveStatus(subscription) {
  const externalId = subscription.externalId || (await resolveTwitch(subscription.handle)).externalId;
  const data = await twitchApiGet('streams', { user_id: externalId });
  const stream = Array.isArray(data?.data) ? data.data[0] : null;
  if (!stream) {
    return { isLive: false };
  }

  const handle = normalizeHandle(subscription.handle, 'twitch');
  const thumbnailUrl = String(stream.thumbnail_url || '')
    .replace('{width}', '1280')
    .replace('{height}', '720');

  return {
    isLive: true,
    sessionId: String(stream.id),
    title: normalizeDbText(stream.title, { maxLen: 300, fallback: null }),
    url: `https://twitch.tv/${handle}`,
    thumbnailUrl: thumbnailUrl || null,
    startedAt: parseIsoDate(stream.started_at),
    gameName: normalizeDbText(stream.game_name, { maxLen: 120, fallback: null }),
    viewerCount: Number(stream.viewer_count || 0) || null,
    displayName: normalizeDbText(subscription.displayName, { maxLen: 120, fallback: handle }),
  };
}

async function fetchYouTubePage(path, options = {}) {
  return axios.get(`https://www.youtube.com/${path.replace(/^\/+/, '')}`, {
    headers: DEFAULT_HEADERS,
    timeout: 20_000,
    validateStatus: () => true,
    ...options,
  });
}

function extractYouTubeMetadata(html) {
  const body = String(html || '');
  const channelId = body.match(/\"externalId\":\"(UC[^\"]+)\"/)?.[1]
    || body.match(/\"browseId\":\"(UC[^\"]+)\"/)?.[1]
    || null;
  const displayName = decodeHtml(
    body.match(/<meta property=\"og:title\" content=\"([^\"]+)\"/)?.[1]
    || body.match(/\"title\":\"([^\"]+)\"/)?.[1]
    || ''
  ) || null;
  const canonicalPath = body.match(/\"canonicalBaseUrl\":\"([^\"]+)\"/)?.[1] || null;
  return {
    channelId,
    displayName,
    canonicalPath,
  };
}

async function resolveYouTube(handleInput) {
  const normalized = normalizeHandle(handleInput, 'youtube');
  if (/^UC[\w-]{20,}$/i.test(normalized)) {
    return {
      handle: normalized,
      externalId: normalized,
      displayName: normalized,
      profileUrl: `https://www.youtube.com/channel/${normalized}`,
    };
  }

  const page = await fetchYouTubePage(normalized);
  if (page.status >= 400) throw new Error('No pude abrir ese canal de YouTube.');
  const meta = extractYouTubeMetadata(page.data);
  if (!meta.channelId) throw new Error('No pude resolver el channel ID de YouTube.');

  return {
    handle: meta.canonicalPath || normalized,
    externalId: meta.channelId,
    displayName: meta.displayName || normalized,
    profileUrl: `https://www.youtube.com/channel/${meta.channelId}`,
  };
}

function extractYouTubeVideoId(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl, 'https://www.youtube.com');
    return parsed.searchParams.get('v');
  } catch {
    return null;
  }
}

async function getYouTubeLiveStatus(subscription) {
  const resolved = subscription.externalId
    ? {
      handle: subscription.handle,
      externalId: subscription.externalId,
      displayName: subscription.displayName,
      profileUrl: subscription.profileUrl || `https://www.youtube.com/channel/${subscription.externalId}`,
    }
    : await resolveYouTube(subscription.handle);

  const response = await fetchYouTubePage(`channel/${resolved.externalId}/live`, {
    maxRedirects: 0,
  });

  const location = response.headers?.location || null;
  if (response.status >= 300 && response.status < 400 && location) {
    const videoId = extractYouTubeVideoId(location);
    return {
      isLive: !!videoId,
      sessionId: videoId,
      title: videoId ? `${resolved.displayName || resolved.handle} en directo` : null,
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : resolved.profileUrl,
      thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : null,
      startedAt: null,
      displayName: resolved.displayName || resolved.handle,
    };
  }

  const body = String(response.data || '');
  const isLive = body.includes('"isLiveNow":true') || body.includes('"isLive":true');
  const videoId = body.match(/\"videoId\":\"([^\"]+)\"/)?.[1] || null;
  const title = decodeHtml(
    body.match(/<meta property=\"og:title\" content=\"([^\"]+)\"/)?.[1]
      || body.match(/\"title\":\"([^\"]+)\"/)?.[1]
      || ''
  ) || null;

  return {
    isLive: !!(isLive && videoId),
    sessionId: isLive ? videoId : null,
    title: title || `${resolved.displayName || resolved.handle} en directo`,
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : resolved.profileUrl,
    thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : null,
    startedAt: null,
    displayName: resolved.displayName || resolved.handle,
  };
}

async function resolveKick(handleInput) {
  const handle = normalizeHandle(handleInput, 'kick');
  return {
    handle,
    externalId: handle,
    displayName: handle,
    profileUrl: `https://kick.com/${handle}`,
  };
}

async function getKickLiveStatus(subscription) {
  const handle = normalizeHandle(subscription.handle, 'kick');
  const response = await axios.get(`https://kick.com/${handle}`, {
    headers: DEFAULT_HEADERS,
    timeout: 20_000,
    validateStatus: () => true,
  });

  if (response.status === 403) {
    throw new Error('Kick bloqueó la comprobación desde este entorno (403).');
  }
  if (response.status >= 400) {
    throw new Error(`Kick devolvió ${response.status}.`);
  }

  const body = String(response.data || '');
  const isLive = body.includes('"is_live":true') || body.includes('"livestream":{');
  const title = decodeHtml(body.match(/"livestream_title":"([^"]+)"/)?.[1] || '') || null;
  const sessionId = body.match(/"session_title":"([^"]+)"/)?.[1]
    || body.match(/"slug":"([^"]+)"/)?.[1]
    || (isLive ? `${handle}:${Date.now()}` : null);
  const thumbnailUrl = body.match(/"thumbnail":"([^"]+)"/)?.[1] || null;

  return {
    isLive,
    sessionId,
    title,
    url: `https://kick.com/${handle}`,
    thumbnailUrl,
    startedAt: null,
    displayName: subscription.displayName || handle,
  };
}

const providers = {
  twitch: {
    resolve: resolveTwitch,
    getLiveStatus: getTwitchLiveStatus,
  },
  youtube: {
    resolve: resolveYouTube,
    getLiveStatus: getYouTubeLiveStatus,
  },
  kick: {
    resolve: resolveKick,
    getLiveStatus: getKickLiveStatus,
  },
};

function getStreamProvider(platformInput) {
  const platform = normalizePlatform(platformInput);
  const provider = providers[platform];
  if (!provider) throw new Error(`Plataforma no soportada: ${platformInput}`);
  return { platform, provider };
}

module.exports = {
  getStreamProvider,
};
