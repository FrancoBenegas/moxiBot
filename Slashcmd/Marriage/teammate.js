const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('teammate')
        .setDescription('Ver la pareja (teammate) de un usuario casado.')
        .addUserOption((opt) =>
            opt.setName('user')
                .setDescription('Usuario objetivo')
                .setRequired(false)
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const target = interaction.options.getUser('user', false) || interaction.user;
        const doc = await getUserDoc(guildId, target.id);

        if (!doc?.marriage?.spouse) {
            return interaction.reply({ content: `<@${target.id}> no tiene teammate de matrimonio.`, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `Teammate de <@${target.id}>: <@${doc.marriage.spouse}>\nCasados desde: ${formatDateTag(doc.marriage.marriedAt)}\nAniversario: ${formatDateTag(doc.marriage.anniversaryDate)}`,
            allowedMentions: { repliedUser: false }
        });
    }
};
