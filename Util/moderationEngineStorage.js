const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const CONFIG_COLLECTION = 'mod_guild_config';
const RULES_COLLECTION = 'mod_blacklist_rules';
const USER_STATE_COLLECTION = 'mod_user_state';
const ACTIONS_COLLECTION = 'mod_actions';

let ensureIndexesPromise = null;

function normalizeId(value) {
    return normalizeDiscordId(value);
}

function normalizeText(value, maxLen = 1000) {
    return normalizeDbText(value, { maxLen, fallback: '' });
}

function buildDefaultConfig() {
    return {
        enabled: true,
        logChannelId: null,
        muteRoleId: null,
        thresholds: {
            warn: 4,
            mute: 7,
            kick: 10,
            ban: 13,
        },
        timeouts: {
            muteMs: 600000,
            muteHardMs: 3600000,
        },
        allowLinksChannels: [],
        allowInvitesChannels: [],
        exemptRoles: [],
        exemptPermissions: ['ModerateMembers', 'Administrator'],
        antiRaid: {
            enabled: true,
            joinSpikeSoft: { joins: 8, perSeconds: 10 },
            joinSpikeHard: { joins: 15, perSeconds: 10 },
            softDurationMs: 600000,
            hardDurationMs: 1800000,
        },
        defenseMode: 'off',
        defenseUntil: null,
        riskDecay: {
            enabled: true,
            decayEveryMs: 600000,
            decayAmount: 1,
            minScore: 0,
        },
        limits: {
            maxMessages5s: 7,
            maxMentions10s: 5,
            maxDuplicateFingerprints20s: 3,
        },
        accountRisk: {
            newAccountDays: 7,
            newMemberMinutes: 10,
        },
    };
}

async function ensureIndexes(db) {
    if (ensureIndexesPromise) return ensureIndexesPromise;

    ensureIndexesPromise = (async () => {
        await db.collection(CONFIG_COLLECTION)
            .createIndex({ guildId: 1 }, { unique: true, name: 'guild_unique' });

        await db.collection(RULES_COLLECTION)
            .createIndex({ guildId: 1, id: 1 }, { unique: true, name: 'guild_rule_unique' });
        await db.collection(RULES_COLLECTION)
            .createIndex({ guildId: 1, enabled: 1, type: 1 }, { name: 'guild_enabled_type_idx' });

        await db.collection(USER_STATE_COLLECTION)
            .createIndex({ guildId: 1, userId: 1 }, { unique: true, name: 'guild_user_unique' });

        await db.collection(ACTIONS_COLLECTION)
            .createIndex({ guildId: 1, createdAt: -1 }, { name: 'guild_created_idx' });
        await db.collection(ACTIONS_COLLECTION)
            .createIndex({ userId: 1, createdAt: -1 }, { name: 'user_created_idx' });
    })();

    return ensureIndexesPromise;
}

async function getCollection(name) {
    const connection = await ensureMongoConnection();
    const db = connection.db;
    await ensureIndexes(db);
    return db.collection(name);
}

async function getGuildConfig({ guildId }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId) return null;

    const col = await getCollection(CONFIG_COLLECTION);
    const doc = await col.findOne({ guildId: cleanGuildId });
    const defaults = buildDefaultConfig();
    if (!doc) return { guildId: cleanGuildId, ...defaults };

    return {
        guildId: cleanGuildId,
        ...defaults,
        ...doc,
        thresholds: { ...defaults.thresholds, ...(doc.thresholds || {}) },
        timeouts: { ...defaults.timeouts, ...(doc.timeouts || {}) },
        antiRaid: { ...defaults.antiRaid, ...(doc.antiRaid || {}) },
        riskDecay: { ...defaults.riskDecay, ...(doc.riskDecay || {}) },
        limits: { ...defaults.limits, ...(doc.limits || {}) },
        accountRisk: { ...defaults.accountRisk, ...(doc.accountRisk || {}) },
        allowLinksChannels: Array.isArray(doc.allowLinksChannels) ? doc.allowLinksChannels : defaults.allowLinksChannels,
        allowInvitesChannels: Array.isArray(doc.allowInvitesChannels) ? doc.allowInvitesChannels : defaults.allowInvitesChannels,
        exemptRoles: Array.isArray(doc.exemptRoles) ? doc.exemptRoles : defaults.exemptRoles,
        exemptPermissions: Array.isArray(doc.exemptPermissions) ? doc.exemptPermissions : defaults.exemptPermissions,
    };
}

async function upsertGuildConfig({ guildId, patch = {} }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId) return false;

    const safePatch = {
        ...(patch.enabled !== undefined ? { enabled: !!patch.enabled } : {}),
        ...(patch.logChannelId !== undefined ? { logChannelId: normalizeId(patch.logChannelId) || null } : {}),
        ...(patch.muteRoleId !== undefined ? { muteRoleId: normalizeId(patch.muteRoleId) || null } : {}),
    };

    const mergeNested = (key) => {
        if (!patch || typeof patch[key] !== 'object' || patch[key] === null) return {};
        return { [key]: patch[key] };
    };

    Object.assign(safePatch, mergeNested('thresholds'));
    Object.assign(safePatch, mergeNested('timeouts'));
    Object.assign(safePatch, mergeNested('antiRaid'));
    Object.assign(safePatch, mergeNested('riskDecay'));
    Object.assign(safePatch, mergeNested('limits'));
    Object.assign(safePatch, mergeNested('accountRisk'));

    if (Array.isArray(patch.allowLinksChannels)) {
        safePatch.allowLinksChannels = Array.from(new Set(patch.allowLinksChannels.map(normalizeId).filter(Boolean)));
    }
    if (Array.isArray(patch.allowInvitesChannels)) {
        safePatch.allowInvitesChannels = Array.from(new Set(patch.allowInvitesChannels.map(normalizeId).filter(Boolean)));
    }
    if (Array.isArray(patch.exemptRoles)) {
        safePatch.exemptRoles = Array.from(new Set(patch.exemptRoles.map(normalizeId).filter(Boolean)));
    }
    if (Array.isArray(patch.exemptPermissions)) {
        safePatch.exemptPermissions = Array.from(new Set(patch.exemptPermissions.map((v) => String(v || '').trim()).filter(Boolean)));
    }
    if (patch.defenseMode) {
        const mode = String(patch.defenseMode).trim().toLowerCase();
        if (['off', 'soft', 'hard'].includes(mode)) safePatch.defenseMode = mode;
    }
    if (patch.defenseUntil !== undefined) {
        safePatch.defenseUntil = patch.defenseUntil ? new Date(patch.defenseUntil) : null;
    }

    const col = await getCollection(CONFIG_COLLECTION);
    const now = new Date();
    const update = {
        $set: { ...safePatch, updatedAt: now },
        $setOnInsert: { guildId: cleanGuildId, createdAt: now },
    };
    const res = await col.updateOne({ guildId: cleanGuildId }, update, { upsert: true });
    return res.matchedCount > 0 || res.upsertedCount > 0;
}

function normalizeRule(rule, guildId) {
    const cleanGuildId = normalizeId(guildId);
    const id = normalizeDbText(rule.id || '', { maxLen: 64, fallback: '' }) || null;
    const type = String(rule.type || '').trim().toUpperCase();
    return {
        id: id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        guildId: cleanGuildId,
        type,
        pattern: normalizeText(rule.pattern || '', 500),
        enabled: rule.enabled !== false,
        severity: Math.max(1, Math.min(10, Number(rule.severity) || 1)),
        actionHint: String(rule.actionHint || 'SCORE_ONLY').trim().toUpperCase(),
        notes: normalizeText(rule.notes || '', 1000) || null,
    };
}

async function upsertRule({ guildId, rule }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId || !rule) return null;

    const normalized = normalizeRule(rule, cleanGuildId);
    const col = await getCollection(RULES_COLLECTION);
    const now = new Date();

    await col.updateOne(
        { guildId: cleanGuildId, id: normalized.id },
        {
            $set: { ...normalized, updatedAt: now },
            $setOnInsert: { createdAt: now },
        },
        { upsert: true }
    );

    return normalized;
}

async function listRules({ guildId, enabledOnly = true }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId) return [];

    const col = await getCollection(RULES_COLLECTION);
    const query = { guildId: cleanGuildId };
    if (enabledOnly) query.enabled = true;
    return await col.find(query).toArray();
}

async function removeRule({ guildId, ruleId }) {
    const cleanGuildId = normalizeId(guildId);
    const cleanRuleId = normalizeText(ruleId || '', 64);
    if (!cleanGuildId || !cleanRuleId) return false;

    const col = await getCollection(RULES_COLLECTION);
    const res = await col.deleteOne({ guildId: cleanGuildId, id: cleanRuleId });
    return res.deletedCount > 0;
}

async function getUserState({ guildId, userId }) {
    const cleanGuildId = normalizeId(guildId);
    const cleanUserId = normalizeId(userId);
    if (!cleanGuildId || !cleanUserId) return null;

    const col = await getCollection(USER_STATE_COLLECTION);
    const doc = await col.findOne({ guildId: cleanGuildId, userId: cleanUserId });
    if (!doc) {
        return {
            guildId: cleanGuildId,
            userId: cleanUserId,
            riskScore: 0,
            strikes: 0,
            shadowbanned: false,
            lastJoinAt: null,
            lastDecayAt: null,
            lastActionAt: null,
        };
    }

    return {
        guildId: cleanGuildId,
        userId: cleanUserId,
        riskScore: Number(doc.riskScore) || 0,
        strikes: Number(doc.strikes) || 0,
        shadowbanned: !!doc.shadowbanned,
        lastJoinAt: doc.lastJoinAt ? new Date(doc.lastJoinAt) : null,
        lastDecayAt: doc.lastDecayAt ? new Date(doc.lastDecayAt) : null,
        lastActionAt: doc.lastActionAt ? new Date(doc.lastActionAt) : null,
    };
}

async function upsertUserState({ guildId, userId, patch = {} }) {
    const cleanGuildId = normalizeId(guildId);
    const cleanUserId = normalizeId(userId);
    if (!cleanGuildId || !cleanUserId) return false;

    const safePatch = {};
    if (patch.riskScore !== undefined) safePatch.riskScore = Number(patch.riskScore) || 0;
    if (patch.strikes !== undefined) safePatch.strikes = Math.max(0, Number(patch.strikes) || 0);
    if (patch.shadowbanned !== undefined) safePatch.shadowbanned = !!patch.shadowbanned;
    if (patch.lastJoinAt !== undefined) safePatch.lastJoinAt = patch.lastJoinAt ? new Date(patch.lastJoinAt) : null;
    if (patch.lastDecayAt !== undefined) safePatch.lastDecayAt = patch.lastDecayAt ? new Date(patch.lastDecayAt) : null;
    if (patch.lastActionAt !== undefined) safePatch.lastActionAt = patch.lastActionAt ? new Date(patch.lastActionAt) : null;

    const col = await getCollection(USER_STATE_COLLECTION);
    const now = new Date();
    const update = {
        $set: { ...safePatch, updatedAt: now },
        $setOnInsert: { guildId: cleanGuildId, userId: cleanUserId, createdAt: now },
    };
    const res = await col.updateOne({ guildId: cleanGuildId, userId: cleanUserId }, update, { upsert: true });
    return res.matchedCount > 0 || res.upsertedCount > 0;
}

async function addModAction({ guildId, userId, action, reason, evidence }) {
    const cleanGuildId = normalizeId(guildId);
    const cleanUserId = normalizeId(userId);
    if (!cleanGuildId || !cleanUserId) return false;

    const doc = {
        guildId: cleanGuildId,
        userId: cleanUserId,
        action: String(action || '').trim().toUpperCase(),
        reason: normalizeText(reason || '', 500),
        evidence: evidence || {},
        createdAt: new Date(),
    };

    const col = await getCollection(ACTIONS_COLLECTION);
    await col.insertOne(doc);
    return true;
}

async function listModActions({ guildId, limit = 50, userId, action }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId) return [];

    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const query = { guildId: cleanGuildId };

    const cleanUserId = normalizeId(userId);
    if (cleanUserId) query.userId = cleanUserId;

    if (action) {
        const cleanAction = String(action).trim().toUpperCase();
        if (cleanAction) query.action = cleanAction;
    }

    const col = await getCollection(ACTIONS_COLLECTION);
    return await col.find(query).sort({ createdAt: -1 }).limit(safeLimit).toArray();
}

async function listRiskUsers({ guildId, limit = 50, minRiskScore = 1 }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId) return [];

    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeMinRisk = Math.max(0, Number(minRiskScore) || 0);

    const col = await getCollection(USER_STATE_COLLECTION);
    return await col
        .find({ guildId: cleanGuildId, riskScore: { $gte: safeMinRisk } })
        .sort({ riskScore: -1, strikes: -1, updatedAt: -1 })
        .limit(safeLimit)
        .toArray();
}

async function getModerationStats({ guildId, days = 7 }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId) return null;

    const safeDays = Math.max(1, Math.min(90, Number(days) || 7));
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const actionsCol = await getCollection(ACTIONS_COLLECTION);
    const rulesCol = await getCollection(RULES_COLLECTION);
    const usersCol = await getCollection(USER_STATE_COLLECTION);

    const [totalActions, recentActions, byAction, totalRules, enabledRules, highRiskUsers, shadowbannedUsers] = await Promise.all([
        actionsCol.countDocuments({ guildId: cleanGuildId }),
        actionsCol.countDocuments({ guildId: cleanGuildId, createdAt: { $gte: since } }),
        actionsCol.aggregate([
            { $match: { guildId: cleanGuildId, createdAt: { $gte: since } } },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]).toArray(),
        rulesCol.countDocuments({ guildId: cleanGuildId }),
        rulesCol.countDocuments({ guildId: cleanGuildId, enabled: true }),
        usersCol.countDocuments({ guildId: cleanGuildId, riskScore: { $gte: 5 } }),
        usersCol.countDocuments({ guildId: cleanGuildId, shadowbanned: true }),
    ]);

    return {
        guildId: cleanGuildId,
        days: safeDays,
        since,
        actions: {
            total: totalActions,
            recent: recentActions,
            byAction: byAction.map((x) => ({ action: x._id || 'UNKNOWN', count: x.count || 0 })),
        },
        rules: {
            total: totalRules,
            enabled: enabledRules,
        },
        users: {
            highRisk: highRiskUsers,
            shadowbanned: shadowbannedUsers,
        },
    };
}

async function ensureDefaultRules({ guildId }) {
    const cleanGuildId = normalizeId(guildId);
    if (!cleanGuildId) return false;

    const col = await getCollection(RULES_COLLECTION);
    const existing = await col.findOne({ guildId: cleanGuildId });
    if (existing) return false;

    const defaults = [
        {
            type: 'DOMAIN',
            pattern: 'EXAMPLE_PHISH_DOMAIN.com',
            severity: 10,
            actionHint: 'BAN',
            enabled: true,
            notes: 'confirmed=true',
        },
        {
            type: 'INVITE',
            pattern: '*',
            severity: 6,
            actionHint: 'DELETE',
            enabled: true,
            notes: 'Invites not allowed outside allowInvitesChannels',
        },
        {
            type: 'REGEX',
            pattern: '(claim|redeem|verify|free|gift).*(https?://|www\\.)',
            severity: 7,
            actionHint: 'MUTE',
            enabled: true,
            notes: 'High risk CTA+link pattern; not ban-direct',
        },
        {
            type: 'ATTACH_EXT',
            pattern: 'exe|scr|bat|cmd|vbs',
            severity: 8,
            actionHint: 'MUTE',
            enabled: true,
            notes: 'Block risky executable attachments',
        },
        {
            type: 'USERNAME',
            pattern: 'discord support|steam support|admin team|moderator',
            severity: 5,
            actionHint: 'SCORE_ONLY',
            enabled: true,
            notes: 'Use together with link/invite for stronger action',
        },
    ];

    const now = new Date();
    const payload = defaults.map((rule) => ({
        ...normalizeRule(rule, cleanGuildId),
        createdAt: now,
        updatedAt: now,
    }));

    await col.insertMany(payload);
    return true;
}

module.exports = {
    buildDefaultConfig,
    getGuildConfig,
    upsertGuildConfig,
    upsertRule,
    listRules,
    removeRule,
    getUserState,
    upsertUserState,
    addModAction,
    listModActions,
    listRiskUsers,
    getModerationStats,
    ensureDefaultRules,
};
