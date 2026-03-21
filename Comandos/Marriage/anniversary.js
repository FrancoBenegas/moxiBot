const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    name: 'anniversary',
    alias: ['anniversary', 'aniversario'],
    Category: marriageCategory,
    usage: 'anniversary [@usuario]',
    description: 'Ver fecha de aniversario y tiempo juntos.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first() || message.author;
        const doc = await getUserDoc(guildId, target.id);
        if (!doc?.marriage?.spouse) {
            return message.reply({ content: `<@${target.id}> no esta casado/a.`, allowedMentions: { repliedUser: false } });
        }

        const ann = doc.marriage.anniversaryDate ? new Date(doc.marriage.anniversaryDate) : null;
        if (!ann || Number.isNaN(ann.getTime())) {
            return message.reply({ content: 'No hay aniversario registrado.', allowedMentions: { repliedUser: false } });
        }

        const now = new Date();
        const next = new Date(ann);
        next.setFullYear(now.getFullYear());
        if (next < now) next.setFullYear(now.getFullYear() + 1);

        const years = Math.max(0, now.getFullYear() - ann.getFullYear());
        const days = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));

        return message.reply({
            content: `Aniversario de <@${target.id}>\nFecha: ${formatDateTag(ann)}\nAnios juntos: ${years}\nProximo aniversario en: ${days} dia(s)`,
            allowedMentions: { repliedUser: false },
        });
    },
};
