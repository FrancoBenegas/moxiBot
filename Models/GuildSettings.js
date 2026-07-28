const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('../Util/idGuards');
const GuildSchema = require('./GuildSchema');
const Welcome = require('./WelcomeSchema');
const Clvls = require('./ClvlsSchema');
const { getAuditSettings, setAuditChannel, setAuditEnabled } = require('./AuditSchema');

let LanguagesModel;
try {
  LanguagesModel = require('./LanguageSchema');
} catch (_) {
  LanguagesModel = null;
}

const collectionName = 'prefixes';

function safeGuildId(guildId) {
  return normalizeDiscordId(guildId);
}

function normalizeModuleStateKey(moduleId) {
  const raw = normalizeDbText(moduleId, { maxLen: 64, fallback: '' })
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return raw || null;
}

async function setGuildEconomyEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { EconomyEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const options = { upsert: true };
  const result = await db.collection(collectionName).updateOne(query, update, options);
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildEconomyChannel(guildId, channelId) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const cleanId = normalizeDiscordId(channelId);

  // Si se limpia el canal, también desactivamos el modo exclusivo.
  const update = cleanId
    ? {
      $set: { EconomyChannelId: cleanId, EconomyExclusive: true },
      $setOnInsert: { guildID: guildId, id: guildId },
    }
    : {
      $unset: { EconomyChannelId: '', EconomyExclusive: '' },
      $setOnInsert: { guildID: guildId, id: guildId },
    };

  const options = { upsert: true };
  const result = await db.collection(collectionName).updateOne(query, update, options);
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildEconomyExclusive(guildId, exclusive) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { EconomyExclusive: !!exclusive },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const options = { upsert: true };
  const result = await db.collection(collectionName).updateOne(query, update, options);
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildMusicPanelConfig(guildId, patch = {}) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;

  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };

  const safePatch = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
    safePatch.MusicFixedPanelEnabled = !!patch.enabled;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'channelId')) {
    const clean = normalizeDiscordId(patch.channelId);
    if (clean) safePatch.MusicFixedPanelChannelId = clean;
    else safePatch.MusicFixedPanelChannelId = null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'messageId')) {
    const clean = normalizeDiscordId(patch.messageId);
    if (clean) safePatch.MusicFixedPanelMessageId = clean;
    else safePatch.MusicFixedPanelMessageId = null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'active')) {
    safePatch.MusicFixedPanelActive = !!patch.active;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'imageUrl')) {
    const raw = normalizeDbText(patch.imageUrl, { maxLen: 2000, fallback: '' }) || null;
    safePatch.MusicFixedPanelImageUrl = raw;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastActiveAt')) {
    const dateValue = patch.lastActiveAt ? new Date(patch.lastActiveAt) : null;
    safePatch.MusicFixedPanelLastActiveAt = dateValue;
  }

  const update = {
    $set: safePatch,
    $setOnInsert: { guildID: guildId, id: guildId },
  };

  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function touchGuildMusicPanelActivity(guildId, { active = true } = {}) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;

  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };

  const update = {
    $set: {
      MusicFixedPanelLastActiveAt: new Date(),
      MusicFixedPanelActive: !!active,
    },
    $setOnInsert: { guildID: guildId, id: guildId },
  };

  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildMusicPanelActive(guildId, active) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;

  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: {
      MusicFixedPanelActive: !!active,
      MusicFixedPanelLastActiveAt: new Date(),
    },
    $setOnInsert: { guildID: guildId, id: guildId },
  };

  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildModuleEnabled(guildId, moduleId, enabled) {
  guildId = safeGuildId(guildId);
  const moduleKey = normalizeModuleStateKey(moduleId);
  if (!guildId || !moduleKey) return false;

  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: {
      [`ModuleStates.${moduleKey}`]: !!enabled,
    },
    $setOnInsert: { guildID: guildId, id: guildId },
  };

  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildPrefix(guildId, prefix) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { Prefix: [normalizeDbText(prefix, { maxLen: 20, fallback: '.' })] },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const options = { upsert: true };
  const result = await db.collection(collectionName).updateOne(query, update, options);
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildLanguage(guildId, lang, ownerId) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const langCode = normalizeDbText(lang, { maxLen: 16, fallback: 'es-ES' });
  if (LanguagesModel && typeof LanguagesModel.updateOne === 'function') {
    try {
      let useMongoose = false;
      try {
        useMongoose = mongoose.connection && mongoose.connection.readyState === 1;
      } catch (_) {
        useMongoose = false;
      }

      if (useMongoose) {
        const res = await LanguagesModel.updateOne(
          { guildID: guildId },
          { $set: { language: langCode }, $setOnInsert: { guildID: guildId } },
          { upsert: true }
        );
        // seguimos abajo para también sincronizar GuildSchema/guilds
      }
    } catch (err) {
      // fall back to the helper-backed path below if Mongoose fails.
    }
  }

  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { language: langCode },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const options = { upsert: true };
  const result = await db.collection('languages').updateOne(query, update, options);

  // Mantener compatibilidad: el bot también guarda/lee el idioma desde `guilds.Language`.
  // Si esto no se actualiza, el idioma se queda pegado al default (es-ES) aunque exista `languages`.
  try {
    const guildQuery = { guildID: guildId };
    const guildUpdate = {
      $set: { Language: langCode },
      $setOnInsert: { guildID: guildId, ownerID: ownerId ?? null },
    };
    await db.collection('guilds').updateOne(guildQuery, guildUpdate, { upsert: true });
  } catch (_) {
    // ignore
  }

  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function getGuildSettings(guildId) {
  guildId = safeGuildId(guildId);
  if (!guildId) return {};
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const doc = await db.collection(collectionName).findOne(query);
  const settings = doc || {};

  try {
    const serverDoc = await GuildSchema.findOne({ guildID: guildId }).lean();
    if (serverDoc) {
      if (serverDoc.Language) {
        settings.Language = serverDoc.Language;
        settings.language = serverDoc.Language;
      }
      if (serverDoc.Welcome) settings.Welcome = serverDoc.Welcome;
      if (serverDoc.Byes) settings.Byes = serverDoc.Byes;
      if (serverDoc.Rank) settings.Rank = serverDoc.Rank;
    }
  } catch (err) {
    // ignore: podemos seguir usando MongoClient
  }

  // Fuente de verdad para el idioma (lo escribe el comando de idioma): colección `languages`.
  // Se consulta SIEMPRE para que no se quede el default de `guilds.Language`.
  try {
    const queryLang = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
    const langDoc = await db.collection('languages').findOne(queryLang);
    if (langDoc && langDoc.language) {
      settings.Language = langDoc.language;
      settings.language = langDoc.language;
    }
  } catch (_) {
    // ignore
  }

  try {
    if ((!settings.Language || settings.Language === '') && LanguagesModel && typeof LanguagesModel.findOne === 'function') {
      const langDoc = await LanguagesModel.findOne({ guildID: guildId }).lean();
      if (langDoc && langDoc.language) {
        settings.Language = langDoc.language;
        settings.language = langDoc.language;
      }
    }
  } catch (_) {
    // ignore
  }

  try {
    const welcomeDoc = await Welcome.findOne({ guildID: guildId, type: 'config' }).lean();
    if (welcomeDoc) {
      settings.WelcomeConfig = {
        enabled: welcomeDoc.enabled,
        channelID: welcomeDoc.channelID,
        message: welcomeDoc.message,
        embed: welcomeDoc.embed,
        updatedAt: welcomeDoc.updatedAt,
      };
    }
  } catch (_) { }

  try {
    const clvlsDoc = await Clvls.findOne({ guildID: guildId }).lean();
    if (clvlsDoc) {
      settings.LevelsConfig = clvlsDoc;
    }
  } catch (_) { }

  try {
    const clvlsDoc = await Clvls.findOne({ guildID: guildId }).lean();
    if (clvlsDoc) {
      settings.LevelsConfig = clvlsDoc;
    }
  } catch (_) { }

  try {
    const auditDoc = await getAuditSettings(guildId);
    if (auditDoc) {
      if (auditDoc.channelId !== undefined) {
        settings.AuditChannelId = auditDoc.channelId ?? settings.AuditChannelId ?? null;
      }
      if (auditDoc.enabled !== undefined) {
        settings.AuditEnabled = typeof auditDoc.enabled === 'boolean' ? auditDoc.enabled : settings.AuditEnabled ?? null;
      }
    }
  } catch (_) {
    // ignore
  }

  return settings;
}

async function setGuildAuditChannel(guildId, channelId) {
  return setAuditChannel(guildId, channelId);
}

async function setGuildAuditEnabled(guildId, enabled) {
  return setAuditEnabled(guildId, enabled);
}

async function setGuildStreamAlertsChannel(guildId, channelId) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const cleanId = normalizeDiscordId(channelId);
  const update = cleanId
    ? {
      $set: { StreamAlertsChannelId: cleanId },
      $setOnInsert: { guildID: guildId, id: guildId },
    }
    : {
      $unset: { StreamAlertsChannelId: '' },
      $setOnInsert: { guildID: guildId, id: guildId },
    };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildStreamAlertsEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { StreamAlertsEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildStreamAlertEventEnabled(guildId, eventName, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const eventKeyMap = {
    start: 'StreamAlertsNotifyStart',
    live: 'StreamAlertsNotifyLive',
    end: 'StreamAlertsNotifyEnd',
  };
  const field = eventKeyMap[String(eventName || '').trim().toLowerCase()];
  if (!field) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { [field]: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildMarriageEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageChannel(guildId, channelId) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const cleanId = normalizeDiscordId(channelId);
  const update = cleanId
    ? { $set: { MarriageChannelId: cleanId }, $setOnInsert: { guildID: guildId, id: guildId } }
    : { $unset: { MarriageChannelId: '' }, $setOnInsert: { guildID: guildId, id: guildId } };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageExclusive(guildId, exclusive) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageExclusive: !!exclusive },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageProposalsEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageProposalsEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageProposalTimeout(guildId, hours) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const h = Math.max(1, Math.min(168, parseInt(hours, 10) || 48));
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageProposalTimeoutHours: h },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageCustomAnniversaryEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageCustomAnniversaryEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageAnniversariesEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageAnniversariesEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageAnnounceAnniversaries(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageAnnounceAnniversaries: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageTreeEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageTreeEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageDivorcesEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageDivorcesEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildMarriageDivorceMutualConfirm(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { MarriageDivorceMutualConfirm: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const r = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return r.matchedCount > 0 || r.upsertedCount > 0;
}

async function setGuildStreamLiveReminderMinutes(guildId, minutes) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const parsed = Number.parseInt(String(minutes || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 5) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { StreamAlertsLiveReminderMinutes: parsed },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildUpdatesChannel(guildId, channelId) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const cleanId = normalizeDiscordId(channelId);
  const update = cleanId
    ? {
      $set: { UpdateChannelId: cleanId },
      $setOnInsert: { guildID: guildId, id: guildId },
    }
    : {
      $unset: { UpdateChannelId: '' },
      $setOnInsert: { guildID: guildId, id: guildId },
    };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildUpdatesAutoEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { UpdateAutoEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildUpdatesLastAnnouncedVersion(guildId, version) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const cleanVersion = normalizeDbText(version, { maxLen: 32, fallback: '' });
  if (!cleanVersion) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { UpdateLastAnnouncedVersion: cleanVersion },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildUpdatesLastAnnouncedCommit(guildId, commitHash) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const cleanHash = normalizeDbText(commitHash, { maxLen: 64, fallback: '' });
  if (!cleanHash) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { UpdateLastAnnouncedCommit: cleanHash },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildAutoPurgeConfig(guildId, patch = {}) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;

  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };

  const $set = {};
  const $unset = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
    $set.AutoPurgeEnabled = !!patch.enabled;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'intervalHours')) {
    const raw = Number.parseInt(String(patch.intervalHours ?? '').trim(), 10);
    const interval = Number.isFinite(raw) ? Math.max(1, Math.min(168, raw)) : 24;
    $set.AutoPurgeIntervalHours = interval;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'channels')) {
    const channels = Array.isArray(patch.channels)
      ? patch.channels.map((id) => normalizeDiscordId(id)).filter(Boolean)
      : [];
    $set.AutoPurgeChannels = [...new Set(channels)];
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'lastRunAt')) {
    if (patch.lastRunAt) {
      const dateValue = new Date(patch.lastRunAt);
      if (Number.isFinite(dateValue.getTime())) {
        $set.AutoPurgeLastRunAt = dateValue;
      }
    } else {
      $unset.AutoPurgeLastRunAt = '';
    }
  }

  const update = {
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;

  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildUpdatesChannel(guildId, channelId) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const cleanId = normalizeDiscordId(channelId);
  const update = cleanId
    ? {
      $set: { UpdateChannelId: cleanId },
      $setOnInsert: { guildID: guildId, id: guildId },
    }
    : {
      $unset: { UpdateChannelId: '' },
      $setOnInsert: { guildID: guildId, id: guildId },
    };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildUpdatesAutoEnabled(guildId, enabled) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { UpdateAutoEnabled: !!enabled },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildUpdatesLastAnnouncedVersion(guildId, version) {
  guildId = safeGuildId(guildId);
  if (!guildId) return false;
  const cleanVersion = normalizeDbText(version, { maxLen: 32, fallback: '' });
  if (!cleanVersion) return false;
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { UpdateLastAnnouncedVersion: cleanVersion },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const result = await db.collection(collectionName).updateOne(query, update, { upsert: true });
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

module.exports = {
  setGuildLanguage,
  getGuildSettings,
  setGuildPrefix,
  setGuildAuditChannel,
  setGuildAuditEnabled,
  setGuildStreamAlertsChannel,
  setGuildStreamAlertsEnabled,
  setGuildStreamAlertEventEnabled,
  setGuildStreamLiveReminderMinutes,
  setGuildEconomyEnabled,
  setGuildEconomyChannel,
  setGuildEconomyExclusive,
  setGuildMarriageEnabled,
  setGuildMarriageChannel,
  setGuildMarriageExclusive,
  setGuildMarriageProposalsEnabled,
  setGuildMarriageProposalTimeout,
  setGuildMarriageCustomAnniversaryEnabled,
  setGuildMarriageAnniversariesEnabled,
  setGuildMarriageAnnounceAnniversaries,
  setGuildMarriageTreeEnabled,
  setGuildMarriageDivorcesEnabled,
  setGuildMarriageDivorceMutualConfirm,
  setGuildModuleEnabled,
  setGuildMusicPanelConfig,
  touchGuildMusicPanelActivity,
  setGuildMusicPanelActive,
  setGuildUpdatesChannel,
  setGuildUpdatesAutoEnabled,
  setGuildUpdatesLastAnnouncedVersion,
  setGuildUpdatesLastAnnouncedCommit,
  setGuildAutoPurgeConfig,
  setGuildUpdatesChannel,
  setGuildUpdatesAutoEnabled,
  setGuildUpdatesLastAnnouncedVersion,
};
