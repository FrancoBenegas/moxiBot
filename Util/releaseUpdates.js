const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const {
    getGuildSettingsCached,
    setGuildUpdatesLastAnnouncedVersion,
} = require('./guildSettings');
const { chatCompletion } = require('./openaiChat');

function readCurrentVersion() {
    try {
        // eslint-disable-next-line global-require
        const pkg = require('../package.json');
        return String(pkg?.version || '0.0.0');
    } catch {
        return '0.0.0';
    }
}

function parseReleaseNotes() {
    const notesPath = path.join(__dirname, '..', 'RELEASE_NOTES.md');
    let raw = '';
    try {
        raw = fs.readFileSync(notesPath, 'utf8');
    } catch {
        return [];
    }

    const lines = String(raw || '').split(/\r?\n/);
    const releases = [];
    let current = null;

    for (const line of lines) {
        const match = line.match(/^##\s+v(\d+\.\d+\.\d+)\s*$/i);
        if (match) {
            if (current) releases.push(current);
            current = {
                version: match[1],
                bullets: [],
                commit: '',
            };
            continue;
        }

        if (!current) continue;

        if (/^Commit base:\s*/i.test(line)) {
            current.commit = String(line.replace(/^Commit base:\s*/i, '')).trim();
            continue;
        }

        if (/^\s*-\s+/.test(line)) {
            current.bullets.push(String(line.replace(/^\s*-\s+/, '')).trim());
        }
    }

    if (current) releases.push(current);
    return releases;
}

function compareVersions(a, b) {
    const pa = String(a || '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
    const pb = String(b || '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i += 1) {
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    }
    return 0;
}

function getOrderedReleases() {
    return parseReleaseNotes().sort((a, b) => compareVersions(a.version, b.version));
}

function getReleaseByVersion(version) {
    const ordered = getOrderedReleases();
    return ordered.find((r) => r.version === String(version || '')) || null;
}

function getLatestRelease() {
    const ordered = getOrderedReleases();
    if (!ordered.length) return null;
    return ordered[ordered.length - 1];
}

function estimateChangeMagnitude(latest, previous) {
    if (!latest) return { level: 'unknown', score: 0, label: 'Sin datos' };
    const latestBullets = Array.isArray(latest.bullets) ? latest.bullets.length : 0;
    const previousBullets = Array.isArray(previous?.bullets) ? previous.bullets.length : 0;
    const diffBullets = Math.max(0, latestBullets - previousBullets);

    let score = latestBullets + diffBullets;

    const keywords = ['sistema', 'modulo', 'integracion', 'panel', 'streaming', 'music', 'perfil', 'comando'];
    for (const b of latest.bullets || []) {
        const low = String(b || '').toLowerCase();
        if (keywords.some((k) => low.includes(k))) score += 1;
    }

    if (score >= 8) return { level: 'large', score, label: 'Grande' };
    if (score >= 4) return { level: 'medium', score, label: 'Media' };
    return { level: 'small', score, label: 'Pequena' };
}

function getReleaseContext() {
    const currentVersion = readCurrentVersion();
    const ordered = getOrderedReleases();
    const current = getReleaseByVersion(currentVersion) || getLatestRelease();

    let previous = null;
    if (current) {
        const idx = ordered.findIndex((r) => r.version === current.version);
        if (idx > 0) previous = ordered[idx - 1];
    }

    const magnitude = estimateChangeMagnitude(current, previous);

    return {
        currentVersion,
        current,
        previous,
        magnitude,
    };
}

function getRepoRoot() {
    return path.join(__dirname, '..');
}

function getTagName(version) {
    const clean = String(version || '').trim();
    return clean ? `v${clean}` : '';
}

function readCommitSubjectsBetweenTags(previousVersion, currentVersion, limit = 30) {
    const prevTag = getTagName(previousVersion);
    const currentTag = getTagName(currentVersion);
    if (!currentTag) return [];

    const range = prevTag ? `${prevTag}..${currentTag}` : currentTag;
    try {
        const stdout = execFileSync(
            'git',
            ['-C', getRepoRoot(), 'log', '--oneline', `-n`, String(limit), range],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        );

        return String(stdout || '')
            .split(/\r?\n/)
            .map((line) => String(line || '').trim())
            .filter(Boolean)
            .map((line) => line.replace(/^[a-f0-9]+\s+/i, '').trim())
            .filter(Boolean);
    } catch {
        return [];
    }
}

function buildHeuristicSummaryLines(ctx) {
    const release = ctx?.current;
    const releaseBullets = (release?.bullets || []).slice(0, 6);
    const commitBullets = readCommitSubjectsBetweenTags(ctx?.previous?.version, ctx?.currentVersion, 12)
        .slice(0, 6)
        .map((line) => line.replace(/^feat:\s*/i, '').replace(/^fix:\s*/i, '').trim());

    const bullets = releaseBullets.length ? releaseBullets : commitBullets;
    if (!bullets.length) {
        return ['- No hay resumen cargado para esta version.'];
    }
    return bullets.map((b) => `- ${b}`);
}

function tokenizeForMatch(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4);
}

function validateAiSummaryLines(lines, sourceBullets) {
    const safeLines = Array.isArray(lines) ? lines : [];
    const safeBullets = Array.isArray(sourceBullets) ? sourceBullets : [];
    if (!safeLines.length || !safeBullets.length) return [];

    const sourceTokens = safeBullets.map((bullet) => new Set(tokenizeForMatch(bullet)));
    const validated = [];

    for (const line of safeLines) {
        const lineTokens = tokenizeForMatch(line);
        if (!lineTokens.length) continue;

        let bestOverlap = 0;
        for (const tokenSet of sourceTokens) {
            let overlap = 0;
            for (const token of lineTokens) {
                if (tokenSet.has(token)) overlap += 1;
            }
            if (overlap > bestOverlap) bestOverlap = overlap;
        }

        // Exigimos al menos 2 tokens relevantes compartidos para considerar el resumen "anclado"
        // al release real. Si no, se descarta y se usa fallback local.
        if (bestOverlap >= 2) {
            validated.push(line.startsWith('- ') ? line : `- ${line.replace(/^[-*]\s*/, '')}`);
        }
    }

    return validated.slice(0, 6);
}

function hasOpenAiKey() {
    const key = process.env.OPENAI_API_KEY;
    return typeof key === 'string' && key.trim().length > 0;
}

async function buildAiSummaryLines(ctx) {
    if (!ctx?.current) return [];
    if (!hasOpenAiKey()) return [];

    const currentBullets = (ctx.current.bullets || []).slice(0, 20);
    const previousBullets = (ctx.previous?.bullets || []).slice(0, 20);
    const commitSubjects = readCommitSubjectsBetweenTags(ctx.previous?.version, ctx.currentVersion, 20);

    const system = 'Eres un redactor tecnico de changelogs para un bot de Discord. Responde SOLO en espanol. Devuelve maximo 6 lineas, cada una empezando con "- ". Enfocate en cambios funcionales reales para usuarios/admins del servidor. Usa unicamente la informacion proporcionada. No inventes funciones ni generalidades vagas.';
    const user = [
        `Version actual: v${ctx.currentVersion}`,
        `Version anterior: ${ctx.previous ? `v${ctx.previous.version}` : 'N/A'}`,
        `Magnitud detectada: ${ctx.magnitude.label}`,
        '',
        'Commits reales entre versiones:',
        commitSubjects.length ? commitSubjects.map((c) => `- ${c}`).join('\n') : '- Sin commits disponibles',
        '',
        'Cambios reportados en release actual:',
        currentBullets.length ? currentBullets.map((b) => `- ${b}`).join('\n') : '- Sin bullets',
        '',
        'Cambios reportados en release anterior:',
        previousBullets.length ? previousBullets.map((b) => `- ${b}`).join('\n') : '- Sin bullets',
    ].join('\n');

    const res = await chatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
    }).catch(() => ({ ok: false }));

    if (!res?.ok || !res.text) return [];

    const lines = String(res.text)
        .split(/\r?\n/)
        .map((l) => String(l || '').trim())
        .filter(Boolean)
        .map((l) => (l.startsWith('- ') ? l : `- ${l.replace(/^[-*]\s*/, '')}`))
        .slice(0, 6);

    return validateAiSummaryLines(lines, [...currentBullets, ...commitSubjects]);
}

async function buildVersionPanel({ guildName = '', preferAi = true } = {}) {
    const ctx = getReleaseContext();
    let aiLines = [];
    if (preferAi) {
        aiLines = await buildAiSummaryLines(ctx).catch(() => []);
    }
    const fallbackLines = buildHeuristicSummaryLines(ctx);
    const usedAi = Array.isArray(aiLines) && aiLines.length > 0;
    const bulletLines = (usedAi ? aiLines : fallbackLines).join('\n');

    const title = `# ${guildName ? `${guildName} • ` : ''}Moxi Updates`;
    const body = [
        `Version actual: **v${ctx.currentVersion}**`,
        `Version anterior: **${ctx.previous ? `v${ctx.previous.version}` : 'N/A'}**`,
        `Analisis IA de cambio: **${ctx.magnitude.label}** (score ${ctx.magnitude.score})`,
        `Resumen generado por IA: **${usedAi ? 'Si' : 'No (fallback local)'}**`,
        '',
        '**Cambios destacados:**',
        bulletLines,
    ].join('\n');

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(title))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };
}

async function announceUpdateForGuild(client, guild, { force = false } = {}) {
    if (!guild?.id) return { ok: false, reason: 'invalid-guild' };

    const settings = await getGuildSettingsCached(guild.id).catch(() => null);
    const channelId = String(settings?.UpdateChannelId || '').trim();
    const autoEnabled = Boolean(settings?.UpdateAutoEnabled);
    const lastAnnounced = String(settings?.UpdateLastAnnouncedVersion || '').trim();

    if (!channelId) return { ok: false, reason: 'no-channel' };
    if (!force && !autoEnabled) return { ok: false, reason: 'auto-disabled' };

    const ctx = getReleaseContext();
    if (!force && lastAnnounced === ctx.currentVersion) {
        return { ok: false, reason: 'already-announced' };
    }

    const shouldAnnounce = force || (lastAnnounced !== ctx.currentVersion && ctx.magnitude.level === 'large');
    if (!shouldAnnounce) return { ok: false, reason: 'no-significant-change' };

    const channel = guild.channels.cache.get(channelId)
        || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) return { ok: false, reason: 'channel-missing' };

    const payload = await buildVersionPanel({ guildName: guild.name, preferAi: true });
    await channel.send(payload).catch(() => null);

    await setGuildUpdatesLastAnnouncedVersion(guild.id, ctx.currentVersion).catch(() => null);

    return { ok: true, version: ctx.currentVersion };
}

async function runAutoUpdateAnnouncements(client) {
    if (!client?.guilds?.cache) return;
    for (const guild of client.guilds.cache.values()) {
        // eslint-disable-next-line no-await-in-loop
        await announceUpdateForGuild(client, guild, { force: false }).catch(() => null);
    }
}

module.exports = {
    readCurrentVersion,
    getReleaseContext,
    buildVersionPanel,
    announceUpdateForGuild,
    runAutoUpdateAnnouncements,
};
