const { marriageCategory } = require('../../Util/commandCategories');
const {
    parseAnniversaryInput,
    createProposal,
    buildProposalMessage,
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

        return message.reply(buildProposalMessage({
            proposerId: message.author.id,
            targetUserId: targetUser.id,
            anniversaryDate: parsed.date,
        }));
    },
};
