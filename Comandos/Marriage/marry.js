const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { marriageCategory } = require('../../Util/commandCategories');
const { Bot } = require('../../Config');
const {
    formatDateTag,
    parseAnniversaryInput,
    createProposal,
} = require('../../Util/marriageCore');

module.exports = {
    name: 'marry',
    alias: ['marry', 'proposemarriage', 'pedirmatrimonio'],
    Category: marriageCategory,
    usage: 'marry @usuario [DD/MM/YYYY]',
    description: 'Enviar una propuesta de matrimonio.',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply({ content: 'Debes mencionar a quien quieres proponer.', allowedMentions: { repliedUser: false } });
        }

        const dateToken = args.find((t) => /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(String(t || '')));
        const parsed = parseAnniversaryInput(dateToken);
        if (!parsed.ok) {
            return message.reply({ content: parsed.message, allowedMentions: { repliedUser: false } });
        }

        const res = await createProposal({
            guildId,
            proposer: message.author,
            targetUser,
            anniversaryDate: parsed.date,
        });

        if (!res.ok) {
            return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`marriage_accept_${message.author.id}_${targetUser.id}`).setLabel('Aceptar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`marriage_reject_${message.author.id}_${targetUser.id}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
        );

        const emb = new EmbedBuilder()
            .setColor(Bot.AccentColor)
            .setTitle('Propuesta de matrimonio')
            .setDescription(`<@${message.author.id}> te propuso matrimonio, <@${targetUser.id}>.`)
            .addFields(
                { name: 'Aniversario', value: formatDateTag(parsed.date), inline: false },
            )
            .setFooter({ text: 'Solo la persona propuesta puede responder.' });

        return message.reply({
            content: `<@${targetUser.id}> tienes una propuesta de matrimonio.`,
            embeds: [emb],
            components: [row],
            allowedMentions: { repliedUser: false },
        });
    },
};
