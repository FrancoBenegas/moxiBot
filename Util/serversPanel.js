const { ContainerBuilder, ButtonStyle, MessageFlags, ThumbnailBuilder } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');

const crypto = require('node:crypto');

const { Bot } = require('../Config');

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function now() {
    return Date.now();
}

function cleanupCache() {
    const cutoff = now() - CACHE_TTL_MS;
    for (const [token, entry] of cache.entries()) {
        if (!entry || typeof entry.createdAt !== 'number' || entry.createdAt < cutoff) {
            cache.delete(token);
        }
    }
}

function createToken() {
    return crypto.randomBytes(6).toString('hex');
}

function setSession({ userId, search, limit, pageSize }) {
    cleanupCache();
    const token = createToken();
    cache.set(token, {
        userId: String(userId),
        search: String(search || ''),
        limit: Number.isFinite(limit) ? limit : 25,
        pageSize: Number.isFinite(pageSize) ? pageSize : 5,
        createdAt: now(),
    });
    return token;
}

function getSession(token) {
    cleanupCache();
    const entry = cache.get(String(token));
    if (!entry) return null;
    entry.createdAt = now();
    return entry;
}

function safeLower(s) {
    return String(s ?? '').toLowerCase();
}

function truncate(str, max = 60) {
    const s = String(str ?? '');
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}...`;
}

async function fetchAllGuilds(client) {
    const localShardId = client?.shard?.ids?.[0] ?? 0;

    if (!client?.shard || typeof client.shard.broadcastEval !== 'function') {
        return Array.from(client?.guilds?.cache?.values?.() ?? []).map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g.memberCount ?? 0,
            shardId: localShardId,
            iconUrl: typeof g.iconURL === 'function' ? (g.iconURL({ size: 256, extension: 'png' }) || null) : null,
        }));
    }

    const results = await client.shard.broadcastEval((c) => {
        const shardId = c?.shard?.ids?.[0] ?? 0;
        return c.guilds.cache.map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g.memberCount ?? 0,
            shardId,
            iconUrl: typeof g.iconURL === 'function' ? (g.iconURL({ size: 256, extension: 'png' }) || null) : null,
        }));
    });

    return Array.isArray(results) ? results.flat().filter(Boolean) : [];
}

function buildContainerHeader({ title, summary, filterLine, pageLine }) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);

    container.addTextDisplayComponents((c) => c.setContent(`# ${title}`));
    container.addSeparatorComponents((s) => s.setDivider(true));

    const lines = [summary, filterLine, pageLine].filter(Boolean).join('\n');
    container.addTextDisplayComponents((c) => c.setContent(lines));

    return container;
}

function addGuildBlock(container, guild, idx) {
    const number = String(idx + 1).padStart(2, '0');
    const name = truncate(guild?.name, 80);
    const members = Number(guild?.memberCount) || 0;
    const shardNumber = Number.isFinite(guild?.shardId) ? Number(guild.shardId) + 1 : null;
    const shardText = shardNumber ? String(shardNumber) : 'n/a';
    const id = String(guild?.id ?? '');
    const iconUrl = typeof guild?.iconUrl === 'string' && /^https?:\/\//i.test(guild.iconUrl) ? guild.iconUrl : null;

    const blockText = [
        `**Server ${number}. ${name}**`,
        `- Members: **${members.toLocaleString()}**`,
        `- Shard: **${shardText}**`,
        `- ID: \`${id}\``,
    ].join('\n');

    if (iconUrl) {
        container.addSectionComponents((section) =>
            section
                .addTextDisplayComponents((c) => c.setContent(blockText))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
        );
        return;
    }

    container.addTextDisplayComponents((c) => c.setContent(blockText));
}

function buildNavButtons({ token, userId, page, totalPages }) {
    const prevDisabled = page <= 0;
    const nextDisabled = page >= Math.max(0, totalPages - 1);

    const prev = new ButtonBuilder()
        .setCustomId(`servers:nav:${token}:${userId}:prev`)
        .setLabel('Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(prevDisabled);

    const next = new ButtonBuilder()
        .setCustomId(`servers:nav:${token}:${userId}:next`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(nextDisabled);

    const close = new ButtonBuilder()
        .setCustomId(`servers:close:${token}:${userId}`)
        .setLabel('Cerrar')
        .setStyle(ButtonStyle.Danger);

    return [prev, next, close];
}

async function buildServersPanel({ client, userId, token, search, limit = 25, page = 0, pageSize = 5, t }) {
    const allGuilds = await fetchAllGuilds(client);
    const totalGuilds = allGuilds.length;
    const totalUsers = allGuilds.reduce((sum, g) => sum + (Number(g?.memberCount) || 0), 0);

    const filtered = search
        ? allGuilds.filter((g) => safeLower(g?.name).includes(safeLower(search)))
        : allGuilds;

    filtered.sort((a, b) => (Number(b?.memberCount) || 0) - (Number(a?.memberCount) || 0));

    const maxRequested = Math.max(1, Math.min(50, Number(limit) || 25));
    const candidates = filtered.slice(0, maxRequested);

    const safePageSize = Math.max(1, Math.min(10, Number(pageSize) || 5));
    const totalPages = Math.max(1, Math.ceil(candidates.length / safePageSize));
    const safePage = Math.max(0, Math.min(totalPages - 1, Number(page) || 0));

    const start = safePage * safePageSize;
    const pageItems = candidates.slice(start, start + safePageSize);

    const title = (t && t('SERVERS_TITLE', 'Servidores del bot')) || 'Servidores del bot';
    const summary = `${(t && t('SERVERS_TOTAL', 'Total')) || 'Total'}: **${totalGuilds.toLocaleString()}**  |  ${(t && t('SERVERS_USERS', 'Usuarios')) || 'Usuarios'}: **${totalUsers.toLocaleString()}**`;
    const filterLine = search ? `${(t && t('SERVERS_FILTER', 'Filtro')) || 'Filtro'}: **${search}**  |  ${(t && t('SERVERS_MATCHES', 'Coincidencias')) || 'Coincidencias'}: **${filtered.length.toLocaleString()}**` : null;
    const pageLine = `Pagina **${safePage + 1}/${totalPages}**  |  Mostrando **${pageItems.length}** de **${candidates.length}**`;

    const container = buildContainerHeader({ title, summary, filterLine, pageLine });

    if (!pageItems.length) {
        container.addSeparatorComponents((s) => s.setDivider(true));
        container.addTextDisplayComponents((c) => c.setContent((t && t('SERVERS_NONE', 'No se encontraron servidores con ese filtro.')) || 'No se encontraron servidores con ese filtro.'));
    } else {
        container.addSeparatorComponents((s) => s.setDivider(true));
        pageItems.forEach((g, i) => {
            addGuildBlock(container, g, start + i);
            if (i !== pageItems.length - 1) {
                container.addSeparatorComponents((s) => s.setDivider(true));
            }
        });
    }

    container.addSeparatorComponents((s) => s.setDivider(true));
    container.addActionRowComponents((row) =>
        row.addComponents(...buildNavButtons({ token, userId, page: safePage, totalPages }))
    );

    return {
        payload: {
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        },
        meta: {
            page: safePage,
            totalPages,
            totalGuilds,
            totalUsers,
            filteredCount: filtered.length,
            shownCount: pageItems.length,
        },
    };
}

module.exports = {
    setSession,
    getSession,
    buildServersPanel,
};
