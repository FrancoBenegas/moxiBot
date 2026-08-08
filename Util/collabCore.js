const crypto = require('crypto');
const { ContainerBuilder } = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');
const { formatGlobalFooter } = require('./seasonBrand');
const Collab = require('../Models/CollabSchema');

const CATEGORY_MAP = Object.freeze({
    diseno: 'design',
    diseño: 'design',
    design: 'design',
    code: 'code',
    codigo: 'code',
    coding: 'code',
    musica: 'music',
    música: 'music',
    music: 'music',
    video: 'video',
    social: 'social',
    evento: 'event',
    event: 'event',
    otro: 'other',
    other: 'other',
});

const STATUS_ALIASES = Object.freeze({
    pendiente: 'pending',
    pending: 'pending',
    aprobada: 'approved',
    aprobado: 'approved',
    approved: 'approved',
    aceptada: 'approved',
    aceptado: 'approved',
    denied: 'denied',
    denegada: 'denied',
    denegado: 'denied',
    rechazada: 'denied',
    rechazadao: 'denied',
    cancelled: 'cancelled',
    cancelada: 'cancelled',
    cancelado: 'cancelled',
    completed: 'completed',
    completada: 'completed',
    completado: 'completed',
});

function normalizeCategory(input) {
    const raw = String(input || '').trim().toLowerCase();
    return CATEGORY_MAP[raw] || 'other';
}

function normalizeStatus(input) {
    const raw = String(input || '').trim().toLowerCase();
    return STATUS_ALIASES[raw] || '';
}

function makeRequestId() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function normalizeRequestId(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    const clean = raw.replace(/^#/, '').trim();
    return clean.toUpperCase();
}

function statusLabel(status) {
    if (status === 'approved') return 'APROBADA';
    if (status === 'denied') return 'DENEGADA';
    if (status === 'cancelled') return 'CANCELADA';
    if (status === 'completed') return 'COMPLETADA';
    return 'PENDIENTE';
}

function statusEmoji(status) {
    if (status === 'approved') return '✅';
    if (status === 'denied') return '❌';
    if (status === 'cancelled') return '🛑';
    if (status === 'completed') return '🏁';
    return '🟡';
}

function categoryLabel(category) {
    if (category === 'design') return 'Diseño';
    if (category === 'code') return 'Código';
    if (category === 'music') return 'Música';
    if (category === 'video') return 'Video';
    if (category === 'social') return 'Social Media';
    if (category === 'event') return 'Evento';
    return 'Otro';
}

function isStaffMember(member, cfg) {
    const roleId = normalizeDiscordId(cfg?.staffRoleID);
    const hasAdmin = Boolean(
        member?.permissions?.has?.('Administrator')
        || member?.permissions?.has?.('ManageGuild')
    );
    if (hasAdmin) return true;
    if (!roleId || !member?.roles) return false;

    if (member.roles.cache?.has?.(roleId)) return true;
    if (Array.isArray(member.roles)) return member.roles.includes(roleId);
    if (Array.isArray(member.roles?.value)) return member.roles.value.includes(roleId);
    return false;
}

function buildCollabCard({ doc, botName }) {
    const footer = formatGlobalFooter(botName || 'Moxi', new Date().getFullYear());
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${statusEmoji(doc.status)} Colaboración #${doc.requestId}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent([
            `**Estado:** ${statusLabel(doc.status)}`,
            `**Categoría:** ${categoryLabel(doc.category)}`,
            `**Autor:** <@${doc.authorID}>`,
            `**Título:** ${doc.title || '-'}`,
            `**Descripción:** ${doc.description || '-'}`,
            doc.reason ? `**Motivo:** ${doc.reason}` : null,
        ].filter(Boolean).join('\n')))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(footer));
    return container;
}

async function getConfig(guildId) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return null;
    return Collab.findOne({ guildID: gid, type: 'config' }).lean().catch(() => null);
}

async function upsertConfig(guildId, guildName, patch = {}) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return null;
    const now = new Date();
    const safePatch = {
        enabled: patch?.enabled === undefined ? undefined : !!patch.enabled,
        channelID: patch?.channelID === undefined ? undefined : (normalizeDiscordId(patch.channelID) || null),
        staffRoleID: patch?.staffRoleID === undefined ? undefined : (normalizeDiscordId(patch.staffRoleID) || null),
    };
    await Collab.updateOne(
        { guildID: gid, type: 'config' },
        {
            $setOnInsert: { guildID: gid, type: 'config', createdAt: now },
            $set: {
                guildName: normalizeDbText(guildName, { maxLen: 120, fallback: '' }) || null,
                ...safePatch,
                updatedAt: now,
            },
        },
        { upsert: true }
    );
    return getConfig(gid);
}

async function createRequest({ guildId, guildName, authorId, authorTag, category, title, description }) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return null;

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
        try {
            created = await Collab.create({
                type: 'request',
                guildID: gid,
                guildName: normalizeDbText(guildName, { maxLen: 120, fallback: '' }) || null,
                requestId: makeRequestId(),
                authorID: normalizeDiscordId(authorId) || null,
                authorTag: normalizeDbText(authorTag, { maxLen: 80, fallback: '' }) || null,
                category: normalizeCategory(category),
                title: normalizeDbText(title, { maxLen: 120, fallback: '' }) || null,
                description: normalizeDbText(description, { maxLen: 1600, fallback: '' }) || null,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        } catch {
            created = null;
        }
    }

    return created;
}

async function findRequest(guildId, rawId) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return null;
    const id = normalizeRequestId(rawId);
    if (!id) return null;

    const isSnowflake = /^\d{16,22}$/.test(id);
    const query = isSnowflake
        ? { guildID: gid, type: 'request', messageID: id }
        : { guildID: gid, type: 'request', requestId: id };

    return Collab.findOne(query).catch(() => null);
}

async function listRequests(guildId, { status = '', limit = 10 } = {}) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return [];
    const safeStatus = normalizeStatus(status);
    const safeLimit = Math.max(1, Math.min(30, Number(limit) || 10));
    const query = { guildID: gid, type: 'request' };
    if (safeStatus) query.status = safeStatus;
    return Collab.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean().catch(() => []);
}

async function saveRequestMessageMeta(doc, message) {
    if (!doc || !message) return;
    doc.messageID = normalizeDiscordId(message.id) || null;
    doc.messageChannelID = normalizeDiscordId(message.channel?.id) || null;
    doc.updatedAt = new Date();
    await doc.save().catch(() => null);
}

async function refreshRequestMessage(guild, doc, botName) {
    if (!guild || !doc?.messageID || !doc?.messageChannelID) return;
    const chId = String(doc.messageChannelID);
    const msgId = String(doc.messageID);
    const channel = guild.channels.cache.get(chId) || await guild.channels.fetch(chId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg) return;
    const card = buildCollabCard({ doc, botName });
    await msg.edit({ content: '', components: [card], allowedMentions: { parse: [] } }).catch(() => null);
}

module.exports = {
    normalizeCategory,
    normalizeStatus,
    normalizeRequestId,
    categoryLabel,
    statusLabel,
    statusEmoji,
    isStaffMember,
    buildCollabCard,
    getConfig,
    upsertConfig,
    createRequest,
    findRequest,
    listRequests,
    saveRequestMessageMeta,
    refreshRequestMessage,
};
