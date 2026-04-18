const axios = require("axios");

/* ====================== LOG BONITO ====================== */
function log(level, msg) {
    const t = new Date().toISOString().replace("T", " ").split(".")[0];
    const c = { INFO: "\x1b[36m", OK: "\x1b[32m", WARN: "\x1b[33m", ERROR: "\x1b[31m", RESET: "\x1b[0m" };
    console.log(`${c.RESET}[${t}] [Spotify][${c[level]}${level}${c.RESET}] ${msg}`);
}

/* ====================== TOKEN CACHE ====================== */

let cachedToken = null;
let tokenExpirationTime = 0;

async function getToken() {
    const now = Date.now();

    if (cachedToken && now < tokenExpirationTime) return cachedToken;

    log("INFO", "Renovando token de Spotify...");

    const result = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({ grant_type: "client_credentials" }),
        {
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(
                        process.env.SPOTIFY_CLIENT_ID +
                        ":" +
                        process.env.SPOTIFY_CLIENT_SECRET
                    ).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    cachedToken = result.data.access_token;
    tokenExpirationTime = now + result.data.expires_in * 1000 - 60_000;

    log("OK", "Token renovado correctamente.");
    return cachedToken;
}

/* ====================== FORMATEO DE TRACK ====================== */

function formatTrack(t) {
    return {
        trackUrl: t.external_urls.spotify,
        id: t.id,
        name: t.name,
        author: t.artists.map(a => a.name).join(", "),
        duration: t.duration_ms,
        image: t.album.images?.[0]?.url || "",
    };
}

const SPOTIFY_ALL_MARKETS = [
    "US", "CA", "MX", "CR", "SV", "GT", "HN", "NI", "PA", "AR", "BR", "CL", "CO", "CU", "DO", "EC", "PE", "PY", "UY", "VE",
    "AT", "BE", "FR", "DE", "IE", "IT", "LU", "NL", "PT", "ES", "CH", "GB", "BG", "HR", "CZ", "DK", "EE", "FI", "GR", "HU",
    "LV", "LT", "MT", "PL", "RO", "SK", "SI", "SE", "TR", "UA", "IS", "NO", "LI", "CY", "BH", "IL", "JO", "KW", "LB", "OM",
    "QA", "SA", "AE", "AZ", "KZ", "BD", "IN", "PK", "LK", "BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "VN", "CN",
    "HK", "JP", "KR", "MO", "TW", "AU", "FJ", "NZ", "EG", "GH", "KE", "NG", "TN", "ZA"
];

function parseSpotifyMarkets(rawValue) {
    const raw = typeof rawValue === "string" ? rawValue.trim().toUpperCase() : "";
    if (!raw) return [];
    return raw
        .split(/[\s,;]+/)
        .map((m) => m.trim())
        .filter((m) => /^[A-Z]{2}$/.test(m));
}

function getSpotifyMarketMaxAttempts() {
    const raw = Number(process.env.SPOTIFY_MARKET_MAX_TRIES);
    if (!Number.isFinite(raw)) return 20;
    return Math.min(100, Math.max(1, Math.floor(raw)));
}

function getSpotifyMarketCandidates() {
    const envSingle = parseSpotifyMarkets(process.env.SPOTIFY_MARKET)[0] || "";
    const envList = parseSpotifyMarkets(process.env.SPOTIFY_MARKETS);
    const preferred = envList.length ? envList : [envSingle].filter(Boolean);

    const candidates = [
        ...preferred,
        "US", "ES", "GB", "CA", "MX", "BR", "JP", "KR",
        ...SPOTIFY_ALL_MARKETS,
    ];

    const unique = Array.from(new Set(candidates));
    return unique.slice(0, getSpotifyMarketMaxAttempts());
}

function compactMarkets(markets, { preview = 8 } = {}) {
    if (!Array.isArray(markets) || !markets.length) return "US, ES";
    if (markets.length <= preview) return markets.join(", ");
    const head = markets.slice(0, preview).join(", ");
    return `${head} (+${markets.length - preview} más)`;
}

function logSpotifyMarketHint(status, markets, title = "") {
    const marketsText = `Mercados probados: ${compactMarkets(markets)}. Puedes fijarlo con SPOTIFY_MARKET=US (o ES).`;

    if (title) {
        log("WARN", `Parece publico (${title}), pero Spotify API devolvio ${status}.`);
    } else {
        log("WARN", `Spotify API devolvio ${status}.`);
    }
    log("WARN", marketsText);
    log("WARN", "Esto puede ser una restriccion de Spotify. Prueba con SPOTIFY_MARKET=US o usa YouTube.");
}

/* ====================== FALLBACK INTELIGENTE ====================== */

async function fallbackSearch(trackName, artistName, token, markets = getSpotifyMarketCandidates()) {
    log("WARN", "Usando fallback inteligente (búsqueda)…");

    const query = `${artistName} ${trackName}`;

    for (const market of markets) {
        try {
            const res = await axios.get("https://api.spotify.com/v1/search", {
                headers: { Authorization: `Bearer ${token}` },
                params: { q: query, type: "track", limit: 10, market }
            });

            const items = res.data.tracks.items ?? [];
            log("OK", `Fallback encontró ${items.length} resultados (market=${market}).`);

            if (items.length) {
                log("INFO", `Fallback exitoso con market=${market}.`);
                return items.map(formatTrack);
            }
        } catch (e) {
            const status = e?.response?.status;
            if ((status === 403 || status === 404) && markets.length > 1) continue;
        }
    }

    log("ERROR", "Fallback también falló.");
    return [];
}

/* ====================== FUNCIÓN PRINCIPAL ====================== */

async function getRecommendations(trackId) {
    try {
        const token = await getToken();
        const markets = getSpotifyMarketCandidates();

        /* 1️⃣ VERIFICAR QUE EL TRACK EXISTE */
        let info = null;
        let lastInfoStatus = 0;
        let selectedTrackMarket = "";
        for (const market of markets) {
            try {
                info = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { market }
                });
                selectedTrackMarket = market;
                break;
            } catch (e) {
                const status = e?.response?.status;
                lastInfoStatus = status || 0;
                if ((status === 403 || status === 404) && markets.length > 1) continue;
                throw e;
            }
        }

        if (!info?.data) {
            if (lastInfoStatus === 403 || lastInfoStatus === 404) {
                logSpotifyMarketHint(lastInfoStatus, markets);
            }
            log("ERROR", "Track no encontrado → Spotify API devolvió 404 real.");
            return [];
        }

        const trackName = info.data.name;
        const artistName = info.data.artists[0].name;
        if (selectedTrackMarket) {
            log("INFO", `Track metadata resuelto con market=${selectedTrackMarket}.`);
        }

        /* 2️⃣ RECOMENDACIONES NATIVAS */
        log("INFO", `Obteniendo recomendaciones nativas para ID: ${trackId}`);

        let recs;
        let lastRecStatus = 0;
        let selectedRecMarket = "";

        for (const market of markets) {
            try {
                const res = await axios.get("https://api.spotify.com/v1/recommendations", {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        limit: 10,
                        seed_tracks: trackId,
                        market
                    }
                });
                recs = res.data.tracks;
                selectedRecMarket = market;
                break;
            } catch (e) {
                const status = e?.response?.status;
                lastRecStatus = status || 0;
                if ((status === 403 || status === 404) && markets.length > 1) continue;
                log("WARN", "API de recomendaciones falló → usando fallback.");
                return fallbackSearch(trackName, artistName, token, markets);
            }
        }

        if (!recs && (lastRecStatus === 403 || lastRecStatus === 404)) {
            logSpotifyMarketHint(lastRecStatus, markets, trackName);
            return fallbackSearch(trackName, artistName, token, markets);
        }

        if (!recs || recs.length === 0) {
            log("WARN", "Nativas devolvieron 0 → fallback.");
            return fallbackSearch(trackName, artistName, token, markets);
        }

        const final = recs.map(formatTrack);
        if (selectedRecMarket) {
            log("INFO", `Recomendaciones resueltas con market=${selectedRecMarket}.`);
        }
        log("OK", `Recomendaciones obtenidas: ${final.length}`);

        return final;

    } catch (e) {
        log("ERROR", `Error inesperado: ${e.message}`);
        return [];
    }
}

module.exports = { getRecommendations };
