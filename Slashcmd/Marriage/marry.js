const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { parseAnniversaryInput, createProposal, buildProposalMessage } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('marry')
        .setDescription('Enviar una propuesta de matrimonio.')
        .addUserOption((opt) =>
            opt.setName('user')
                .setDescription('Usuario a quien quieres proponer')
                .setRequired(true)
        )
        .addStringOption((opt) =>
            opt.setName('anniversary')
                .setDescription('Fecha DD/MM/YYYY')
                .setRequired(false)
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const targetUser = interaction.options.getUser('user', true);
        const anniversaryInput = interaction.options.getString('anniversary', false);

        const parsed = parseAnniversaryInput(anniversaryInput);
        if (!parsed.ok) {
            return interaction.reply({ content: parsed.message, flags: MessageFlags.Ephemeral });
        }

        const res = await createProposal({
            guildId,
            proposer: interaction.user,
            targetUser,
            anniversaryDate: parsed.date
        });

        if (!res.ok) {
            return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply(buildProposalMessage({
            proposerId: interaction.user.id,
            targetUserId: targetUser.id,
            anniversaryDate: parsed.date,
        }));
    }
};
