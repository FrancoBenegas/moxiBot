const User = require('../Models/UserSchema');

const PROPOSAL_TIMEOUT = 48 * 60 * 60 * 1000;

function formatDateTag(dateLike) {
    if (!dateLike) return '-';
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '-';
    return `<t:${Math.floor(d.getTime() / 1000)}:F>`;
}

function parseAnniversaryInput(input) {
    if (!input) return { ok: true, date: null };
    const text = String(input).trim();
    const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return { ok: false, message: 'Formato invalido. Usa DD/MM/YYYY.' };

    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const date = new Date(year, month - 1, day);

    const valid = date.getFullYear() === year && (date.getMonth() + 1) === month && date.getDate() === day;
    if (!valid) return { ok: false, message: 'Fecha invalida.' };
    if (date.getTime() > Date.now()) return { ok: false, message: 'La fecha del aniversario no puede estar en el futuro.' };
    return { ok: true, date };
}

async function ensureUserDoc(guildId, user) {
    let doc = await User.findOne({ guildID: guildId, userID: user.id });
    if (!doc) {
        doc = new User({ guildID: guildId, userID: user.id, username: user.username });
    }
    doc.username = user.username;
    return doc;
}

async function getUserDoc(guildId, userId) {
    return User.findOne({ guildID: guildId, userID: userId });
}

async function createProposal({ guildId, proposer, targetUser, anniversaryDate }) {
    const proposerDoc = await ensureUserDoc(guildId, proposer);
    const targetDoc = await ensureUserDoc(guildId, targetUser);

    if (targetUser.bot) return { ok: false, message: 'No puedes casarte con bots.' };
    if (proposer.id === targetUser.id) return { ok: false, message: 'No puedes proponerte a ti mismo.' };
    if (proposerDoc.marriage?.spouse) return { ok: false, message: `Ya estas casado con <@${proposerDoc.marriage.spouse}>.` };
    if (targetDoc.marriage?.spouse) return { ok: false, message: `<@${targetUser.id}> ya esta casado/a.` };
    if (targetDoc.marriageProposal?.from) return { ok: false, message: `<@${targetUser.id}> ya tiene una propuesta pendiente.` };

    targetDoc.marriageProposal = {
        from: proposer.id,
        anniversaryDate: anniversaryDate || null,
        createdAt: new Date(),
    };

    await targetDoc.save();
    return { ok: true };
}

async function acceptProposal({ guildId, targetUserId, proposerId }) {
    const targetDoc = await User.findOne({ guildID: guildId, userID: targetUserId });
    if (!targetDoc?.marriageProposal?.from) return { ok: false, message: 'No tienes propuestas pendientes.' };

    if (proposerId && targetDoc.marriageProposal.from !== proposerId) {
        return { ok: false, message: 'No tienes propuesta pendiente de ese usuario.' };
    }

    const createdAt = targetDoc.marriageProposal.createdAt ? new Date(targetDoc.marriageProposal.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime()) || (Date.now() - createdAt.getTime()) > PROPOSAL_TIMEOUT) {
        targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
        await targetDoc.save();
        return { ok: false, message: 'La propuesta expiro.' };
    }

    const finalProposerId = targetDoc.marriageProposal.from;
    let proposerDoc = await User.findOne({ guildID: guildId, userID: finalProposerId });
    if (!proposerDoc) proposerDoc = new User({ guildID: guildId, userID: finalProposerId });

    if (targetDoc.marriage?.spouse || proposerDoc.marriage?.spouse) {
        targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
        await targetDoc.save();
        return { ok: false, message: 'No se pudo completar: alguno ya esta casado.' };
    }

    const now = new Date();
    const ann = targetDoc.marriageProposal.anniversaryDate ? new Date(targetDoc.marriageProposal.anniversaryDate) : now;
    const safeAnn = Number.isNaN(ann.getTime()) ? now : ann;

    targetDoc.marriage = { spouse: finalProposerId, anniversaryDate: safeAnn, marriedAt: now };
    targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
    proposerDoc.marriage = { spouse: targetUserId, anniversaryDate: safeAnn, marriedAt: now };

    await Promise.all([targetDoc.save(), proposerDoc.save()]);
    return { ok: true, proposerId: finalProposerId };
}

async function declineProposal({ guildId, targetUserId, proposerId }) {
    const targetDoc = await User.findOne({ guildID: guildId, userID: targetUserId });
    if (!targetDoc?.marriageProposal?.from) return { ok: false, message: 'No tienes propuestas pendientes.' };

    if (proposerId && targetDoc.marriageProposal.from !== proposerId) {
        return { ok: false, message: 'No tienes propuesta pendiente de ese usuario.' };
    }

    const from = targetDoc.marriageProposal.from;
    targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
    await targetDoc.save();

    return { ok: true, proposerId: from };
}

async function divorce({ guildId, userId }) {
    const userDoc = await User.findOne({ guildID: guildId, userID: userId });
    if (!userDoc?.marriage?.spouse) return { ok: false, message: 'No estas casado/a.' };

    const spouseId = userDoc.marriage.spouse;
    const spouseDoc = await User.findOne({ guildID: guildId, userID: spouseId });

    userDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };
    if (spouseDoc) spouseDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };

    await Promise.all([userDoc.save(), spouseDoc ? spouseDoc.save() : Promise.resolve()]);
    return { ok: true, spouseId };
}

module.exports = {
    PROPOSAL_TIMEOUT,
    formatDateTag,
    parseAnniversaryInput,
    ensureUserDoc,
    getUserDoc,
    createProposal,
    acceptProposal,
    declineProposal,
    divorce,
};
