const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');

const BRAND_BY_SEASON = Object.freeze({
    primavera: {
        emoji: '🌸',
        label: 'Primavera',
        subtitle: 'Flores, ideas nuevas y buena vibra.',
    },
    verano: {
        emoji: '☀️',
        label: 'Verano',
        subtitle: 'Energía alta, ritmo y diversión.',
    },
    otono: {
        emoji: '🍂',
        label: 'Otoño',
        subtitle: 'Creatividad cálida y enfoque.',
    },
    invierno: {
        emoji: '❄️',
        label: 'Invierno',
        subtitle: 'Calma, constancia y magia.',
    },
});

function normalizeSeason(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'otoño') return 'otono';
    if (raw === 'primavera' || raw === 'verano' || raw === 'otono' || raw === 'invierno') {
        return raw;
    }
    return 'invierno';
}

function getActiveSeason() {
    return normalizeSeason(Bot?.SeasonStyle?.activeSeason);
}

function getSeasonBrand() {
    const activeSeason = getActiveSeason();
    const base = BRAND_BY_SEASON[activeSeason] || BRAND_BY_SEASON.invierno;
    return {
        activeSeason,
        emoji: base.emoji,
        label: base.label,
        subtitle: base.subtitle,
    };
}

function getSeasonBadge() {
    const brand = getSeasonBrand();
    return `${brand.emoji} ${brand.label}`;
}

function formatStudioFooter() {
    const brand = getSeasonBrand();
    const studioEmoji = EMOJIS.studioAnim || brand.emoji;
    return `> ${studioEmoji} _**Moxi Studios · ${brand.label}**_`;
}

function formatSessionEndedFooter() {
    const brand = getSeasonBrand();
    return `_**Moxi Studios · ${brand.label}**_ - Sesión Finalizada`;
}

function formatGlobalFooter(botName, year = new Date().getFullYear()) {
    const safeName = String(botName || 'Moxi Studio');
    const badge = getSeasonBadge();
    return `${EMOJIS.copyright} ${safeName} • ${year} • ${badge}`;
}

function withSeasonTitle(baseTitle) {
    const brand = getSeasonBrand();
    const clean = String(baseTitle || '').replace(/^#\s*/, '').trim();
    return `# ${brand.emoji} ${clean}`;
}

module.exports = {
    getSeasonBrand,
    getSeasonBadge,
    formatStudioFooter,
    formatSessionEndedFooter,
    formatGlobalFooter,
    withSeasonTitle,
};
