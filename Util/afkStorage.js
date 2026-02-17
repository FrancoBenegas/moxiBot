const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const COLLECTION = 'afks';
const SCOPE_GLOBAL = 'global';
const SCOPE_GUILD = 'guild';

function resolveBotId(botId) {
    const fromArg = normalizeDiscordId(botId);
    if (fromArg) return fromArg;
    const fromEnv = normalizeDiscordId(process.env.CLIENT_ID);
    if (fromEnv) return fromEnv;
    return 'default-bot';
}

async function getCollection() {
    const connection = await ensureMongoConnection();
    return connection.db.collection(COLLECTION);
}

async function setAfk({ userId, guildId, message, scope = SCOPE_GUILD, botId = null }) {
    const collection = await getCollection();
    const normalizedScope = scope === SCOPE_GLOBAL ? SCOPE_GLOBAL : SCOPE_GUILD;
    const resolvedBotId = resolveBotId(botId);
    const safeUserId = normalizeDiscordId(userId);
    const safeGuildId = normalizeDiscordId(guildId);
    const now = new Date();
    const filter = { userId: safeUserId, scope: normalizedScope, botId: resolvedBotId };
    if (!safeUserId) {
        throw new Error('Invalid userId');
    }
    if (normalizedScope === SCOPE_GUILD && !safeGuildId) {
        throw new Error('Guild scope requires a guildId');
    }
    if (normalizedScope === SCOPE_GUILD) {
        filter.guildId = safeGuildId;
    }
    const doc = {
        userId: safeUserId,
        botId: resolvedBotId,
        scope: normalizedScope,
        guildId: normalizedScope === SCOPE_GUILD ? safeGuildId : null,
        message: normalizeDbText(message, { maxLen: 500 }),
        updatedAt: now,
    };
    const update = {
        $set: doc,
        $setOnInsert: { createdAt: now },
    };
    const result = await collection.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: 'after',
    });
    return result.value || { ...doc, createdAt: now };
}

async function getAfkEntry(userId, guildId, { botId = null } = {}) {
    const collection = await getCollection();
    const resolvedBotId = resolveBotId(botId);
    const safeUserId = normalizeDiscordId(userId);
    const safeGuildId = normalizeDiscordId(guildId);
    if (!safeUserId) return null;
    if (safeGuildId) {
        const guildEntry = await collection.findOne({ userId: safeUserId, botId: resolvedBotId, scope: SCOPE_GUILD, guildId: safeGuildId });
        if (guildEntry) return guildEntry;
    }
    return collection.findOne({ userId: safeUserId, botId: resolvedBotId, scope: SCOPE_GLOBAL });
}

async function clearAfk(userId, { botId = null } = {}) {
    const collection = await getCollection();
    const resolvedBotId = resolveBotId(botId);
    const safeUserId = normalizeDiscordId(userId);
    if (!safeUserId) return false;
    const result = await collection.deleteMany({ userId: safeUserId, botId: resolvedBotId });
    return result.deletedCount > 0;
}

module.exports = {
    setAfk,
    getAfkEntry,
    clearAfk,
    SCOPE_GLOBAL,
    SCOPE_GUILD,
};
