const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { acceptProposal } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('acceptmarriage')
        .setDescription('Aceptar una propuesta de matrimonio pendiente.')
        .addUserOption((opt) =>
            opt.setName('user')
                .setDescription('Proponente especifico (opcional)')
                .setRequired(false)
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const proposerId = interaction.options.getUser('user', false)?.id || null;
        const res = await acceptProposal({ guildId, targetUserId: interaction.user.id, proposerId });

        if (!res.ok) {
            return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `Aceptaste la propuesta de <@${res.proposerId}>. Felicidades por su matrimonio.`,
            allowedMentions: { repliedUser: false }
        });
    }
};
