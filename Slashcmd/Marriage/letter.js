const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('letter')
        .setDescription('Enviar una carta de amor a tu pareja.')
        .addUserOption((opt) =>
            opt.setName('user')
                .setDescription('Tu pareja (opcional)')
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt.setName('mensaje')
                .setDescription('Contenido de la carta')
                .setRequired(true)
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const authorDoc = await getUserDoc(guildId, interaction.user.id);
        if (!authorDoc?.marriage?.spouse) {
            return interaction.reply({ content: 'No estas casado/a.', flags: MessageFlags.Ephemeral });
        }

        const spouseId = String(authorDoc.marriage.spouse);
        const targetId = String(interaction.options.getUser('user', false)?.id || spouseId);
        if (targetId !== spouseId) {
            return interaction.reply({ content: 'Solo puedes enviar letter a tu pareja.', flags: MessageFlags.Ephemeral });
        }

        const text = String(interaction.options.getString('mensaje', true) || '').trim();
        if (!text) {
            return interaction.reply({ content: 'Escribe un mensaje en la opcion mensaje.', flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `Carta para <@${spouseId}>\nDe: <@${interaction.user.id}>\nAniversario: ${formatDateTag(authorDoc.marriage.anniversaryDate)}\n\n${text}`,
            allowedMentions: { repliedUser: false }
        });
    }
};
