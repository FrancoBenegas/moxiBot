const { MessageFlags } = require('discord.js');
const User = require('../../../../Models/UserSchema');

const PROPOSAL_TIMEOUT = 48 * 60 * 60 * 1000; // 48 horas

module.exports = async function marriageButtons(interaction, Moxi, logger) {
    const id = String(interaction.customId || '');
    if (!id.startsWith('marriage_')) return false;
    const parts = id.split('_');
    const action = parts[1] || '';
    const proposerId = parts[2] || '';
    const targetId = parts[3] || '';
    if (!proposerId || !targetId) return true;

    if (interaction.user?.id !== targetId) {
        await interaction.reply({
            content: 'Solo la persona propuesta puede responder.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    if (action === 'accept') return handleAccept(interaction, proposerId, targetId, logger);
    if (action === 'reject') return handleReject(interaction, proposerId, targetId, logger);
    return true;
};

async function handleAccept(interaction, proposerId, targetId, logger) {

    try {
        const targetDocs = await User.find({ userID: targetId, 'marriageProposal.from': proposerId });
        if (!targetDocs.length) {
            await interaction.reply({
                content: 'No tienes una propuesta pendiente de ese usuario.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => null);
            return true;
        }

        let acceptedCount = 0;
        const now = new Date();

        for (const targetDoc of targetDocs) {
            const createdAt = targetDoc?.marriageProposal?.createdAt ? new Date(targetDoc.marriageProposal.createdAt) : null;
            if (!createdAt || Number.isNaN(createdAt.getTime()) || (Date.now() - createdAt.getTime()) > PROPOSAL_TIMEOUT) {
                targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
                await targetDoc.save();
                continue;
            }

            let proposerDoc = await User.findOne({ guildID: targetDoc.guildID, userID: proposerId });
            if (!proposerDoc) {
                proposerDoc = new User({
                    guildID: targetDoc.guildID,
                    userID: proposerId,
                });
            }

            if (targetDoc.marriage?.spouse || proposerDoc.marriage?.spouse) {
                targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
                await targetDoc.save();
                continue;
            }

            const anniversaryDate = targetDoc?.marriageProposal?.anniversaryDate
                ? new Date(targetDoc.marriageProposal.anniversaryDate)
                : now;
            const safeAnniversary = Number.isNaN(anniversaryDate.getTime()) ? now : anniversaryDate;

            targetDoc.marriage = {
                spouse: proposerId,
                anniversaryDate: safeAnniversary,
                marriedAt: now,
            };
            targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };

            proposerDoc.marriage = {
                spouse: targetId,
                anniversaryDate: safeAnniversary,
                marriedAt: now,
            };

            await Promise.all([targetDoc.save(), proposerDoc.save()]);
            acceptedCount++;
        }

        if (acceptedCount === 0) {
            await interaction.reply({
                content: 'La propuesta expiro o no se pudo completar.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => null);
            return true;
        }

        await interaction.reply({
            content: `Aceptaste la propuesta. Matrimonio registrado en ${acceptedCount} servidor(es).`,
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);

        return true;
    } catch (error) {
        logger?.error?.('[marriage-buttons] accept error', error);
        await interaction.reply({
            content: 'Error al aceptar la propuesta.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }
}

async function handleReject(interaction, proposerId, targetId, logger) {

    try {
        const targetDocs = await User.find({ userID: targetId, 'marriageProposal.from': proposerId });
        if (!targetDocs.length) {
            await interaction.reply({
                content: 'No tienes una propuesta pendiente de ese usuario.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => null);
            return true;
        }

        for (const targetDoc of targetDocs) {
            targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
            await targetDoc.save();
        }

        await interaction.reply({
            content: `Rechazaste la propuesta en ${targetDocs.length} servidor(es).`,
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);

        return true;
    } catch (error) {
        logger?.error?.('[marriage-buttons] reject error', error);
        await interaction.reply({
            content: 'Error al rechazar la propuesta.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }
}
