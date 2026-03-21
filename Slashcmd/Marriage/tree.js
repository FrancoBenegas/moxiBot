const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('tree')
        .setDescription('Mostrar arbol de pareja del matrimonio.')
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
            return interaction.reply({ content: `<@${target.id}> no esta casado/a.`, flags: MessageFlags.Ephemeral });
        }

        const tree = [
            `        <@${target.id}>`,
            '             |',
            `        <@${doc.marriage.spouse}>`
        ].join('\n');

        return interaction.reply({
            content: `Arbol de matrimonio\n\n${tree}\n\nCasados desde: ${formatDateTag(doc.marriage.marriedAt)}`,
            allowedMentions: { repliedUser: false }
        });
    }
};
