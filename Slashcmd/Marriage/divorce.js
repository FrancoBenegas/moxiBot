const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { divorce } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('divorce')
        .setDescription('Divorciarte de tu pareja.')
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const res = await divorce({ guildId, userId: interaction.user.id });

        if (!res.ok) {
            return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `Te divorciaste de <@${res.spouseId}>.`,
            flags: MessageFlags.Ephemeral
        });
    }
};
