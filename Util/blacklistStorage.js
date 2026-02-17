const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const COLLECTION = 'blacklists';
let ensureIndexesPromise = null;

function normalizeId(value) {
    return normalizeDiscordId(value);
}

async function ensureIndexes(db) {
    if (ensureIndexesPromise) return ensureIndexesPromise;

    ensureIndexesPromise = (async () => {
        const col = db.collection(COLLECTION);
        await col.createIndex({ scope: 1, guildId: 1, userId: 1 }, { unique: true, name: 'scope_guild_user_unique' });
        await col.createIndex({ scope: 1, userId: 1 }, { name: 'scope_user_idx' });
        await col.createIndex({ guildId: 1, userId: 1 }, { name: 'guild_user_idx' });
        await col.createIndex({ createdAt: -1 }, { name: 'createdAt_desc_idx' });
    })();

    return ensureIndexesPromise;
}

async function getCollection() {
    const connection = await ensureMongoConnection();
    const db = connection.db;
    await ensureIndexes(db);
    return db.collection(COLLECTION);
}

async function upsertBlacklist({ scope, guildId = null, userId, reason = '', createdBy = null }) {
    const cleanScope = String(scope || '').trim().toLowerCase();
    const cleanUserId = normalizeId(userId);
    const cleanGuildId = cleanScope === 'local' ? normalizeId(guildId) : null;
    const cleanBy = normalizeId(createdBy) || null;

    if (!cleanUserId) throw new Error('USER_ID_INVALID');
    if (cleanScope !== 'global' && cleanScope !== 'local') throw new Error('BLACKLIST_SCOPE_INVALID');
    if (cleanScope === 'local' && !cleanGuildId) throw new Error('GUILD_ID_INVALID');

    const col = await getCollection();
    const now = new Date();

    const query = {
        scope: cleanScope,
        guildId: cleanScope === 'local' ? cleanGuildId : null,
        userId: cleanUserId,
    };

    const update = {
        $set: {
            reason: normalizeDbText(reason, { maxLen: 500, fallback: '' }),
            createdBy: cleanBy,
            updatedAt: now,
        },
        $setOnInsert: {
            createdAt: now,
        },
    };

    const res = await col.updateOne(query, update, { upsert: true });
    return res.matchedCount > 0 || res.upsertedCount > 0;
}

async function removeBlacklist({ scope, guildId = null, userId }) {
    const cleanScope = String(scope || '').trim().toLowerCase();
    const cleanUserId = normalizeId(userId);
    const cleanGuildId = cleanScope === 'local' ? normalizeId(guildId) : null;

    if (!cleanUserId) return false;
    if (cleanScope !== 'global' && cleanScope !== 'local') return false;
    if (cleanScope === 'local' && !cleanGuildId) return false;

    const col = await getCollection();
    const query = {
        scope: cleanScope,
        guildId: cleanScope === 'local' ? cleanGuildId : null,
        userId: cleanUserId,
    };
    const res = await col.deleteOne(query);
    return res.deletedCount > 0;
}

async function isUserBlacklisted({ scope, guildId = null, userId }) {
    const cleanScope = String(scope || '').trim().toLowerCase();
    const cleanUserId = normalizeId(userId);
    const cleanGuildId = cleanScope === 'local' ? normalizeId(guildId) : null;

    if (!cleanUserId) return false;
    if (cleanScope !== 'global' && cleanScope !== 'local') return false;
    if (cleanScope === 'local' && !cleanGuildId) return false;

    const col = await getCollection();
    const doc = await col.findOne(
        {
            scope: cleanScope,
            guildId: cleanScope === 'local' ? cleanGuildId : null,
            userId: cleanUserId,
        },
        { projection: { _id: 0, userId: 1 } }
    );

    return !!doc;
}

async function listBlacklist({ scope, guildId = null, limit = 25 }) {
    const cleanScope = String(scope || '').trim().toLowerCase();
    const cleanGuildId = cleanScope === 'local' ? normalizeId(guildId) : null;
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));

    if (cleanScope !== 'global' && cleanScope !== 'local') return [];
    if (cleanScope === 'local' && !cleanGuildId) return [];

    const col = await getCollection();
    const query = cleanScope === 'local'
        ? { scope: cleanScope, guildId: cleanGuildId }
        : { scope: cleanScope, guildId: null };

    return await col
        .find(query, {
            projection: {
                _id: 0,
                scope: 1,
                guildId: 1,
                userId: 1,
                reason: 1,
                createdBy: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .toArray();
}

async function addLocalBlacklist({ guildId, userId, reason = '', createdBy = null }) {
    return upsertBlacklist({ scope: 'local', guildId, userId, reason, createdBy });
}

async function removeLocalBlacklist({ guildId, userId }) {
    return removeBlacklist({ scope: 'local', guildId, userId });
}

async function isUserLocallyBlacklisted({ guildId, userId }) {
    return isUserBlacklisted({ scope: 'local', guildId, userId });
}

async function listLocalBlacklist({ guildId, limit = 25 }) {
    return listBlacklist({ scope: 'local', guildId, limit });
}

async function addGlobalBlacklist({ userId, reason = '', createdBy = null }) {
    return upsertBlacklist({ scope: 'global', userId, reason, createdBy });
}

async function removeGlobalBlacklist({ userId }) {
    return removeBlacklist({ scope: 'global', userId });
}

async function isUserGloballyBlacklisted({ userId }) {
    return isUserBlacklisted({ scope: 'global', userId });
}

async function listGlobalBlacklist({ limit = 25 }) {
    return listBlacklist({ scope: 'global', limit });
}

module.exports = {
    normalizeId,
    addLocalBlacklist,
    removeLocalBlacklist,
    isUserLocallyBlacklisted,
    listLocalBlacklist,
    addGlobalBlacklist,
    removeGlobalBlacklist,
    isUserGloballyBlacklisted,
    listGlobalBlacklist,
};
