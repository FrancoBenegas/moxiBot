const { Bot } = require('../Config');
const { getSeasonStyleState, setSeasonStyleState } = require('../Models/BotSeasonStyleSchema');

const BASE_ACCENT_COLOR = Number.isFinite(Number(Bot?.AccentColor)) ? Number(Bot.AccentColor) : 0xFFB6E6;

const SEASON_COLORS = {
    primavera: 0x84CC16,
    verano: 0xF59E0B,
    otono: 0xC2410C,
    invierno: 0x38BDF8,
};

function normalizeSeasonInput(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'otoño') return 'otono';
    if (['spring', 'primavera'].includes(raw)) return 'primavera';
    if (['summer', 'verano'].includes(raw)) return 'verano';
    if (['autumn', 'fall', 'otono', 'otoño'].includes(raw)) return 'otono';
    if (['winter', 'invierno'].includes(raw)) return 'invierno';
    return '';
}

function normalizeHemisphereInput(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['north', 'norte'].includes(raw)) return 'north';
    if (['south', 'sur'].includes(raw)) return 'south';
    return '';
}

function getSeasonByDate(date = new Date(), hemisphere = 'north') {
    const month = date.getUTCMonth() + 1;
    const north = String(hemisphere || 'north').toLowerCase() !== 'south';

    let season = 'invierno';
    if (month >= 3 && month <= 5) season = 'primavera';
    else if (month >= 6 && month <= 8) season = 'verano';
    else if (month >= 9 && month <= 11) season = 'otono';
    else season = 'invierno';

    if (north) return season;

    if (season === 'primavera') return 'otono';
    if (season === 'verano') return 'invierno';
    if (season === 'otono') return 'primavera';
    return 'verano';
}

function seasonLabel(season) {
    if (season === 'primavera') return 'Primavera';
    if (season === 'verano') return 'Verano';
    if (season === 'otono') return 'Otono';
    return 'Invierno';
}

function hemisphereLabel(hemisphere) {
    return String(hemisphere || 'north').toLowerCase() === 'south' ? 'Sur' : 'Norte';
}

function colorToHex(color) {
    const n = Number(color);
    const safe = Number.isFinite(n) ? Math.max(0, Math.min(0xFFFFFF, Math.floor(n))) : BASE_ACCENT_COLOR;
    return `#${safe.toString(16).toUpperCase().padStart(6, '0')}`;
}

function resolveSeasonRuntime(state = {}, now = new Date()) {
    const mode = String(state?.mode || 'auto').toLowerCase();
    const hemisphere = String(state?.hemisphere || 'north').toLowerCase() === 'south' ? 'south' : 'north';
    const manualSeason = normalizeSeasonInput(state?.manualSeason) || 'primavera';

    let activeSeason = getSeasonByDate(now, hemisphere);
    if (mode === 'manual') activeSeason = manualSeason;

    const seasonalColor = SEASON_COLORS[activeSeason] || BASE_ACCENT_COLOR;
    const accentColor = mode === 'off' ? BASE_ACCENT_COLOR : seasonalColor;

    return {
        mode: mode === 'manual' || mode === 'off' ? mode : 'auto',
        hemisphere,
        manualSeason,
        activeSeason,
        accentColor,
        accentHex: colorToHex(accentColor),
    };
}

function applyRuntime(runtime) {
    Bot.AccentColor = runtime.accentColor;
    Bot.SeasonStyle = {
        mode: runtime.mode,
        hemisphere: runtime.hemisphere,
        manualSeason: runtime.manualSeason,
        activeSeason: runtime.activeSeason,
        accentHex: runtime.accentHex,
        updatedAt: new Date(),
    };
    return runtime;
}

async function getSeasonStyleSnapshot(now = new Date()) {
    const state = await getSeasonStyleState();
    const runtime = resolveSeasonRuntime(state, now);
    return {
        ...state,
        ...runtime,
    };
}

async function refreshSeasonStyle(now = new Date()) {
    const snapshot = await getSeasonStyleSnapshot(now);
    applyRuntime(snapshot);
    return snapshot;
}

async function updateSeasonStyle(patch = {}, actor = {}) {
    const nextModeRaw = patch?.mode;
    const nextSeasonRaw = patch?.manualSeason;
    const nextHemisphereRaw = patch?.hemisphere;

    const nextMode = nextModeRaw === undefined ? undefined : String(nextModeRaw || '').trim().toLowerCase();
    const nextSeason = nextSeasonRaw === undefined ? undefined : normalizeSeasonInput(nextSeasonRaw);
    const nextHemisphere = nextHemisphereRaw === undefined ? undefined : normalizeHemisphereInput(nextHemisphereRaw);

    const persisted = await setSeasonStyleState({
        mode: nextMode || undefined,
        manualSeason: nextSeason || undefined,
        hemisphere: nextHemisphere || undefined,
        updatedBy: actor?.id || '',
        updatedByTag: actor?.tag || '',
    });

    const snapshot = {
        ...persisted,
        ...resolveSeasonRuntime(persisted, new Date()),
    };
    applyRuntime(snapshot);
    return snapshot;
}

function formatSeasonStatus(snapshot) {
    const mode = snapshot?.mode || 'auto';
    const modeText = mode === 'manual' ? 'MANUAL' : (mode === 'off' ? 'OFF' : 'AUTO');
    const active = seasonLabel(snapshot?.activeSeason || 'invierno');
    const manual = seasonLabel(snapshot?.manualSeason || 'primavera');
    const hemisphere = hemisphereLabel(snapshot?.hemisphere || 'north');
    const color = snapshot?.accentHex || colorToHex(BASE_ACCENT_COLOR);
    return {
        modeText,
        active,
        manual,
        hemisphere,
        color,
    };
}

module.exports = {
    normalizeSeasonInput,
    normalizeHemisphereInput,
    getSeasonByDate,
    seasonLabel,
    hemisphereLabel,
    colorToHex,
    resolveSeasonRuntime,
    getSeasonStyleSnapshot,
    refreshSeasonStyle,
    updateSeasonStyle,
    formatSeasonStatus,
};
