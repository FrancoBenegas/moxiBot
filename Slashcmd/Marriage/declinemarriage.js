const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { declineProposal } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('declinemarriage')
        .setDescription('Rechazar una propuesta de matrimonio pendiente.')
        .addUserOption((opt) =>
            opt.setName('user')
                .setDescription('Proponente especifico (opcional)')
                .setRequired(false)
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const proposerId = interaction.options.getUser('user', false)?.id || null;
        const res = await declineProposal({ guildId, targetUserId: interaction.user.id, proposerId });

        if (!res.ok) {
            return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `Rechazaste la propuesta de <@${res.proposerId}>.`,
            allowedMentions: { repliedUser: false }
        });
    }
};
