const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { marriageCategory } = require('../../Util/commandCategories');
const { Bot } = require('../../Config');
const User = require('../../Models/UserSchema');

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

function buildStatusEmbed(targetUser, spouseUser, marriage) {
    const ann = marriage?.anniversaryDate ? new Date(marriage.anniversaryDate) : null;
    const marriedAt = marriage?.marriedAt ? new Date(marriage.marriedAt) : ann;

    let years = '-';
    let nextInDays = '-';

    if (ann && !Number.isNaN(ann.getTime())) {
        const now = new Date();
        years = Math.max(0, now.getFullYear() - ann.getFullYear());
        const next = new Date(ann);
        next.setFullYear(now.getFullYear());
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        nextInDays = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));
    }

    return new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle(' Estado de matrimonio')
        .addFields(
            { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
            { name: 'Pareja', value: `<@${marriage.spouse}>`, inline: true },
            { name: 'Casados desde', value: formatDateTag(marriedAt), inline: false },
            { name: 'Aniversario', value: formatDateTag(ann), inline: true },
            { name: 'Proximo aniversario', value: nextInDays === '-' ? '-' : `En ${nextInDays} dia(s)`, inline: true },
            { name: 'Anos juntos', value: String(years), inline: true },
        )
        .setFooter({ text: `${targetUser.username}  ${spouseUser?.username || 'Usuario'}` });
}

async function ensureUserDoc(guildId, user) {
    let doc = await User.findOne({ guildID: guildId, userID: user.id });
    if (!doc) doc = new User({ guildID: guildId, userID: user.id, username: user.username });
    doc.username = user.username;
    return doc;
}

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('marriage')
        .setDescription('Comando directo: ver estado, proponer o divorciarse.')
        .addUserOption((opt) =>
            opt.setName('user')
                .setDescription('Usuario objetivo (si lo pones, se propone matrimonio)')
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt.setName('anniversary')
                .setDescription('Fecha de aniversario DD/MM/YYYY (solo para proponer)')
                .setRequired(false)
        )
        .addBooleanOption((opt) =>
            opt.setName('divorce')
                .setDescription('Pon true para divorciarte')
                .setRequired(false)
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const target = interaction.options.getUser('user', false);
        const anniversaryInput = interaction.options.getString('anniversary', false);
        const wantsDivorce = interaction.options.getBoolean('divorce', false) === true;

        try {
            if (wantsDivorce) return handleDivorce(Moxi, interaction, guildId);

            const parsedDate = parseAnniversaryInput(anniversaryInput);
            if (!parsedDate.ok) {
                return interaction.reply({ content: ` ${parsedDate.message}`, flags: MessageFlags.Ephemeral });
            }

            if (target && target.id !== interaction.user.id) {
                return handlePropose(Moxi, interaction, guildId, interaction.user, target, parsedDate.date);
            }

            if (anniversaryInput && (!target || target.id === interaction.user.id)) {
                return interaction.reply({
                    content: ' La fecha solo se usa al proponer a otra persona.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            return handleView(Moxi, interaction, guildId, target || interaction.user);
        } catch (error) {
            console.error('[marriage-slash] error:', error);
            return interaction.reply({ content: ' Ocurrio un error con /marriage.', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
    },
};

async function handlePropose(Moxi, interaction, guildId, proposer, targetUser, anniversaryDate) {
    if (targetUser.bot) {
        return interaction.reply({ content: ' No puedes casarte con bots.', flags: MessageFlags.Ephemeral });
    }

    const proposerDoc = await ensureUserDoc(guildId, proposer);
    const targetDoc = await ensureUserDoc(guildId, targetUser);

    if (proposerDoc.marriage?.spouse) {
        return interaction.reply({ content: ` Ya estas casado con <@${proposerDoc.marriage.spouse}>.`, flags: MessageFlags.Ephemeral });
    }
    if (targetDoc.marriage?.spouse) {
        return interaction.reply({ content: ` <@${targetUser.id}> ya esta casado/a.`, flags: MessageFlags.Ephemeral });
    }
    if (targetDoc.marriageProposal?.from) {
        return interaction.reply({ content: ` <@${targetUser.id}> ya tiene una propuesta pendiente.`, flags: MessageFlags.Ephemeral });
    }

    targetDoc.marriageProposal = {
        from: proposer.id,
        anniversaryDate: anniversaryDate || null,
        createdAt: new Date(),
    };
    await targetDoc.save();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`marriage_accept_${proposer.id}_${targetUser.id}`).setLabel('Aceptar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`marriage_reject_${proposer.id}_${targetUser.id}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
    );

    const emb = new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle(' Propuesta de matrimonio')
        .setDescription(`<@${proposer.id}> te ha propuesto matrimonio.`)
        .addFields(
            { name: 'Proponente', value: `<@${proposer.id}>`, inline: true },
            { name: 'Destino', value: `<@${targetUser.id}>`, inline: true },
            { name: 'Aniversario', value: formatDateTag(anniversaryDate), inline: false },
        )
        .setFooter({ text: 'Tienes 48 horas para responder.' });

    await interaction.reply({
        content: `<@${targetUser.id}>, tienes una propuesta de matrimonio.`,
        embeds: [emb],
        components: [row],
        allowedMentions: { repliedUser: false },
    });
}

async function handleView(Moxi, interaction, guildId, targetUser) {
    const userDoc = await User.findOne({ guildID: guildId, userID: targetUser.id });
    if (!userDoc?.marriage?.spouse) {
        return interaction.reply({ content: ` <@${targetUser.id}> no esta casado/a.`, flags: MessageFlags.Ephemeral });
    }

    let spouseUser = null;
    try {
        spouseUser = await Moxi.users.fetch(userDoc.marriage.spouse);
    } catch {
        spouseUser = null;
    }

    const embed = buildStatusEmbed(targetUser, spouseUser, userDoc.marriage);
    return interaction.reply({ embeds: [embed] });
}

async function handleDivorce(Moxi, interaction, guildId) {
    const userId = interaction.user.id;
    const userDoc = await User.findOne({ guildID: guildId, userID: userId });
    if (!userDoc?.marriage?.spouse) {
        return interaction.reply({ content: ' No estas casado/a.', flags: MessageFlags.Ephemeral });
    }

    const spouseId = userDoc.marriage.spouse;
    const spouseDoc = await User.findOne({ guildID: guildId, userID: spouseId });

    userDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };
    if (spouseDoc) spouseDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };

    await Promise.all([userDoc.save(), spouseDoc ? spouseDoc.save() : Promise.resolve()]);

    await interaction.reply({ content: ` Te divorciaste de <@${spouseId}>.`, flags: MessageFlags.Ephemeral });
}
