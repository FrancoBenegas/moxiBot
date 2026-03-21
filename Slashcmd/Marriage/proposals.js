const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('proposals')
        .setDescription('Ver tu propuesta de matrimonio pendiente.')
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const doc = await getUserDoc(guildId, interaction.user.id);

        if (!doc?.marriageProposal?.from) {
            return interaction.reply({ content: 'No tienes propuestas pendientes.', flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `Tienes una propuesta pendiente de <@${doc.marriageProposal.from}>.\nCreada: ${formatDateTag(doc.marriageProposal.createdAt)}\nAniversario: ${formatDateTag(doc.marriageProposal.anniversaryDate)}`,
            allowedMentions: { repliedUser: false }
        });
    }
};
