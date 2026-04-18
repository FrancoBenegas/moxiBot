const { ensureMongoConnection } = require('../Util/mongoConnect');

const COLLECTION = 'bot_settings';
const DOC_KEY = 'season_style';

const ALLOWED_MODES = new Set(['auto', 'manual', 'off']);
const ALLOWED_SEASONS = new Set(['primavera', 'verano', 'otono', 'invierno']);
const ALLOWED_HEMISPHERES = new Set(['north', 'south']);

function normalizeText(value, maxLen = 100) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    if (!text) return '';
    return text.slice(0, maxLen);
}

function normalizeMode(value) {
    const raw = String(value || '').trim().toLowerCase();
    return ALLOWED_MODES.has(raw) ? raw : 'auto';
}

function normalizeSeason(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'otoño') return 'otono';
    return ALLOWED_SEASONS.has(raw) ? raw : 'primavera';
}

function normalizeHemisphere(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'norte') return 'north';
    if (raw === 'sur') return 'south';
    return ALLOWED_HEMISPHERES.has(raw) ? raw : 'north';
}

function normalizeState(doc) {
    const mode = normalizeMode(doc?.mode);
    const manualSeason = normalizeSeason(doc?.manualSeason);
    const hemisphere = normalizeHemisphere(doc?.hemisphere);
    const updatedBy = normalizeText(doc?.updatedBy, 40);
    const updatedByTag = normalizeText(doc?.updatedByTag, 80);
    const updatedAt = doc?.updatedAt instanceof Date
        ? doc.updatedAt
        : (doc?.updatedAt ? new Date(doc.updatedAt) : null);

    return {
        mode,
        manualSeason,
        hemisphere,
        updatedBy,
        updatedByTag,
        updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
    };
}

async function getSeasonStyleState() {
    if (!String(process.env.MONGODB || '').trim()) {
        return normalizeState({});
    }

    try {
        const connection = await ensureMongoConnection();
        const db = connection.db;
        const doc = await db.collection(COLLECTION).findOne({ key: DOC_KEY });
        return normalizeState(doc || {});
    } catch {
        return normalizeState({});
    }
}

async function setSeasonStyleState({ mode, manualSeason, hemisphere, updatedBy, updatedByTag } = {}) {
    const current = await getSeasonStyleState();
    const next = {
        mode: mode === undefined ? current.mode : normalizeMode(mode),
        manualSeason: manualSeason === undefined ? current.manualSeason : normalizeSeason(manualSeason),
        hemisphere: hemisphere === undefined ? current.hemisphere : normalizeHemisphere(hemisphere),
    };

    const now = new Date();
    const nextUpdatedBy = normalizeText(updatedBy, 40);
    const nextUpdatedByTag = normalizeText(updatedByTag, 80);

    if (String(process.env.MONGODB || '').trim()) {
        try {
            const connection = await ensureMongoConnection();
            const db = connection.db;

            await db.collection(COLLECTION).updateOne(
                { key: DOC_KEY },
                {
                    $setOnInsert: {
                        key: DOC_KEY,
                        createdAt: now,
                    },
                    $set: {
                        mode: next.mode,
                        manualSeason: next.manualSeason,
                        hemisphere: next.hemisphere,
                        updatedBy: nextUpdatedBy,
                        updatedByTag: nextUpdatedByTag,
                        updatedAt: now,
                    },
                },
                { upsert: true }
            );
        } catch {
            // best-effort sin persistencia
        }
    }

    return {
        ...next,
        updatedBy: nextUpdatedBy,
        updatedByTag: nextUpdatedByTag,
        updatedAt: now,
    };
}

module.exports = {
    getSeasonStyleState,
    setSeasonStyleState,
    normalizeSeason,
    normalizeHemisphere,
};
