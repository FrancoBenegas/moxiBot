const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');
const formatDuration = require("../Util/formate.js");
const { Bot } = require("../Config");
const { EMOJIS } = require("../Util/emojis");
const { formatSessionEndedFooter, formatStudioFooter } = require('../Util/seasonBrand');
const { getDisplaySongName, renderMusicCard } = require('../Util/musicCardRenderer');
const {
    buildMusicControlsRow,
    buildMusicVolumeRow,
    buildDisabledMusicSessionContainer,
} = require('../Components/V2/musicControlsComponent');
const { getGuildSettingsCached, setGuildMusicPanelActive, setGuildMusicPanelConfig } = require('../Util/guildSettings');
const {
    buildActiveMusicPanelData,
    getMusicPanelMessage,
    initMusicPanelTimeline,
    renderActiveMusicPanel,
    setMusicPanelMessage,
    startMusicPanelAutoUpdate,
    stopMusicPanelAutoUpdate,
} = require('../Util/musicPanelAutoUpdater');

// Sin placeholder: si no hay portada real, no mostramos imagen.
const FALLBACK_IMG = String(process.env.MUSIC_FALLBACK_IMAGE_URL || '').trim();

const spotifyOEmbedCache = new Map();

function pickFirstString(...values) {
    for (const v of values) {
        if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
    return null;
}

async function getBestArtworkUrl(track, fallbackUrl) {
    const direct = pickFirstString(
        track?.info?.image,
        track?.info?.artworkUrl,
        track?.info?.thumbnail,
        track?.info?.coverUrl,
        track?.pluginInfo?.image,
        track?.pluginInfo?.artworkUrl,
        track?.pluginInfo?.thumbnail,
        track?.pluginInfo?.albumArtUrl
    );
    if (direct) return direct;

    const uri = pickFirstString(track?.info?.uri);
    const canFetch = typeof globalThis.fetch === 'function';

    let oembedUrl = uri;
    if (oembedUrl && oembedUrl.startsWith('spotify:')) {
        const parts = oembedUrl.split(':');
        const kind = parts[1];
        const id = parts[2];
        if (kind && id && ['track', 'album', 'playlist', 'episode', 'show'].includes(kind)) {
            oembedUrl = `https://open.spotify.com/${kind}/${id}`;
        }
    }

    if (oembedUrl && canFetch && oembedUrl.includes('open.spotify.com')) {
        const cached = spotifyOEmbedCache.get(oembedUrl);
        if (cached) return cached;
        try {
            const res = await globalThis.fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(oembedUrl)}`);
            if (res.ok) {
                const json = await res.json();
                const oembedThumb = pickFirstString(json?.thumbnail_url, json?.thumbnail_url_with_play_button);
                if (oembedThumb) {
                    spotifyOEmbedCache.set(oembedUrl, oembedThumb);
                    return oembedThumb;
                }
            }
        } catch {
            // ignore
        }
    }

    return pickFirstString(fallbackUrl, FALLBACK_IMG);
}

function getEnvNumber(key, fallback) {
    const raw = process.env[key];
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getPlayerVolumePercent(player) {
    const candidates = [player?.volume, player?.filters?.volume, player?.currentVolume];
    const found = candidates.find((v) => Number.isFinite(Number(v)));
    if (!Number.isFinite(Number(found))) return 100;
    return clampNumber(Math.round(Number(found)), 0, 100);
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

module.exports = async (Moxi, player, track) => {
    try {
        const channel = Moxi.channels.cache.get(player.textChannel);
        if (!channel) return;
        let guildId = player.guild?.id || player.guildId || player.options?.guildId;

        const startPos = Number(track?.info?.position);
        initMusicPanelTimeline(player, Number.isFinite(startPos) ? startPos : 0);
        stopMusicPanelAutoUpdate(player);

        const guildSettings = await getGuildSettingsCached(guildId).catch(() => null);
        const fixedPanelEnabled = !!guildSettings?.MusicFixedPanelEnabled;
        const fixedPanelChannelId = String(guildSettings?.MusicFixedPanelChannelId || '');
        const fixedPanelMessageId = String(guildSettings?.MusicFixedPanelMessageId || '');
        const configuredPanelImage = String(guildSettings?.MusicFixedPanelImageUrl || '').trim();

        if (fixedPanelEnabled && fixedPanelChannelId && fixedPanelChannelId === String(channel.id) && fixedPanelMessageId) {
            const fixedMessage = await channel.messages.fetch(fixedPanelMessageId).catch(() => null);
            if (fixedMessage) {
                setMusicPanelMessage(player, fixedMessage);
                Moxi.previousMessage = fixedMessage;

                const defaultPanelImage = configuredPanelImage
                    || String(process.env.MUSIC_FALLBACK_IMAGE_URL || '').trim()
                    || Moxi?.user?.displayAvatarURL?.({ extension: 'png', size: 1024 })
                    || null;

                // En panel fijo activo priorizamos portada real; si no existe, usamos fallback configurado.
                const artworkUrl = await getBestArtworkUrl(track, defaultPanelImage);
                await player.set('lastSessionData', {
                    title: '',
                    info: '',
                    imageUrl: artworkUrl || null,
                    artworkSourceUrl: artworkUrl || null,
                });

                await renderActiveMusicPanel({ client: Moxi, player, message: fixedMessage, force: true });
                startMusicPanelAutoUpdate(Moxi, player, fixedMessage);
                await setGuildMusicPanelActive(guildId, true).catch(() => null);
                return;
            }
        }

        // --- 1. DESACTIVAR BOTONES ANTERIORES ---
        const lastSession = await player.get("lastSessionData");
        const previousPanelMessage = getMusicPanelMessage(player) || Moxi.previousMessage;

        if (previousPanelMessage && lastSession) {
            try {
                const disabledContainer = buildDisabledMusicSessionContainer({
                    title: lastSession.title,
                    info: lastSession.info,
                    imageUrl: lastSession.imageUrl,
                    footerText: formatSessionEndedFooter(),
                });

                await previousPanelMessage.edit({
                    components: [disabledContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (e) {
                console.log("Error al desactivar botones anteriores:", e.message);
            }
        }

        // --- 2. GENERAR NUEVA TARJETA ---
        const trackDuration = track.info.isStream ? "LIVE" : formatDuration(track.info.length);
        const artworkUrl = await getBestArtworkUrl(track, null);

        // --- 2. GENERAR NUEVA TARJETA (musicard -> Melt) ---
        // Nota: progress/tiempos reales se verán mejor en updates; en trackStart normalmente estamos en 0:00.
        let buffer = null;
        if (artworkUrl) {
            try {
                buffer = await renderMusicCard({
                    trackName: getDisplaySongName(track?.info?.title, track?.info?.author),
                    artistName: String(track?.info?.author || 'Unknown Artist'),
                    albumArt: artworkUrl,
                    fallbackArt: FALLBACK_IMG || artworkUrl,
                    timeStart: '0:00',
                    timeEnd: String(trackDuration || '0:00'),
                    progressBar: 2,
                    volumeBar: getPlayerVolumePercent(player),
                    isExplicit: isTrackExplicit(track),
                });
            } catch {
                buffer = null;
            }
        }
        const fileName = `moxi_${Date.now()}.png`;
        const hasBuffer = Buffer.isBuffer(buffer) && buffer.length > 0;
        const attachmentPayload = hasBuffer ? { attachment: buffer, name: fileName } : null;


        // Traducción internacionalizada con idioma de la base de datos
        const moxi = require("../i18n");
        guildId = player.guild?.id || player.guildId || player.options?.guildId;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const imageUrlForGallery = hasBuffer ? `attachment://${fileName}` : (artworkUrl || null);

        const initialPanel = await buildActiveMusicPanelData({
            player,
            lang,
            imageUrl: imageUrlForGallery,
        });

        // --- 3. CONSTRUIR CONTAINER NUEVO ---

        // Fila 1: Controles
        const buttonsRow = buildMusicControlsRow();

        // Fila 2: Volumen
        const volumeRow = buildMusicVolumeRow();

        const mainContainer = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(initialPanel?.title || ''));

        if (imageUrlForGallery) {
            mainContainer
                .addSeparatorComponents(new SeparatorBuilder())
                .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(imageUrlForGallery)
                ));
        }

        mainContainer
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(initialPanel?.info || ''))
            .addActionRowComponents(buttonsRow)
            .addSeparatorComponents(new SeparatorBuilder()) // Separador solicitado
            .addActionRowComponents(volumeRow)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(initialPanel?.footerText || formatStudioFooter()));

        // --- 4. ENVIAR Y GUARDAR ---
        const sendPayload = {
            components: [mainContainer],
            flags: MessageFlags.IsComponentsV2,
        };

        if (attachmentPayload) sendPayload.files = [attachmentPayload];

        const newMessage = await channel.send(sendPayload);

        Moxi.previousMessage = newMessage;
        setMusicPanelMessage(player, newMessage);

        const finalImageUrl = newMessage.attachments.first()?.url || artworkUrl || null;

        await player.set("lastSessionData", {
            title: initialPanel?.title || '',
            info: initialPanel?.info || '',
            imageUrl: finalImageUrl,
            artworkSourceUrl: artworkUrl || finalImageUrl
        });

        if (fixedPanelEnabled) {
            await setGuildMusicPanelConfig(guildId, {
                channelId: channel.id,
                messageId: newMessage.id,
                active: true,
                lastActiveAt: new Date(),
            }).catch(() => null);
        } else {
            await setGuildMusicPanelActive(guildId, true).catch(() => null);
        }

        await renderActiveMusicPanel({ client: Moxi, player, message: newMessage, force: true });
        startMusicPanelAutoUpdate(Moxi, player, newMessage);

    } catch (error) {
        console.error("Error en trackStart:", error);
    }
};