const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('anniversary')
        .setDescription('Ver fecha de aniversario y tiempo juntos.')
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

        const ann = doc.marriage.anniversaryDate ? new Date(doc.marriage.anniversaryDate) : null;
        if (!ann || Number.isNaN(ann.getTime())) {
            return interaction.reply({ content: 'No hay aniversario registrado.', flags: MessageFlags.Ephemeral });
        }

        const now = new Date();
        const next = new Date(ann);
        next.setFullYear(now.getFullYear());
        if (next < now) next.setFullYear(now.getFullYear() + 1);

        const years = Math.max(0, now.getFullYear() - ann.getFullYear());
        const days = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));

        return interaction.reply({
            content: `Aniversario de <@${target.id}>\nFecha: ${formatDateTag(ann)}\nAnios juntos: ${years}\nProximo aniversario en: ${days} dia(s)`,
            allowedMentions: { repliedUser: false }
        });
    }
};
