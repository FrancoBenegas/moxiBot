const { ensureMongoConnection } = require('./mongoConnect');

const COLLECTION = 'afks';
const SCOPE_GLOBAL = 'global';
const SCOPE_GUILD = 'guild';

function resolveBotId(botId) {
    const fromArg = String(botId || '').trim();
    if (fromArg) return fromArg;
    const fromEnv = String(process.env.CLIENT_ID || '').trim();
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
    const now = new Date();
    const filter = { userId, scope: normalizedScope, botId: resolvedBotId };
    if (normalizedScope === SCOPE_GUILD && !guildId) {
        throw new Error('Guild scope requires a guildId');
    }
    if (normalizedScope === SCOPE_GUILD) {
        filter.guildId = guildId;
    }
    const doc = {
        userId,
        botId: resolvedBotId,
        scope: normalizedScope,
        guildId: normalizedScope === SCOPE_GUILD ? guildId : null,
        message,
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
    if (guildId) {
        const guildEntry = await collection.findOne({ userId, botId: resolvedBotId, scope: SCOPE_GUILD, guildId });
        if (guildEntry) return guildEntry;
    }
    return collection.findOne({ userId, botId: resolvedBotId, scope: SCOPE_GLOBAL });
}

async function clearAfk(userId, { botId = null } = {}) {
    const collection = await getCollection();
    const resolvedBotId = resolveBotId(botId);
    const result = await collection.deleteMany({ userId, botId: resolvedBotId });
    return result.deletedCount > 0;
}

module.exports = {
    setAfk,
    getAfkEntry,
    clearAfk,
    SCOPE_GLOBAL,
    SCOPE_GUILD,
};
