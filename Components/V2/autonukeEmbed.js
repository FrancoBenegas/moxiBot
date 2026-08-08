const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');

const DEFAULT_AUTONUKE_GIF_URL =
    'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif';

// Components V2: mensaje informativo tras ejecutar autonuke
module.exports = function buildAutonukeEmbed({ lang = 'es-ES', authorId } = {}) {
    const executedBy = authorId ? `\n${moxi.translate('EXECUTED_BY', lang)} <@${authorId}>` : '';
    const gifUrl = String(process.env.AUTONUKE_GIF_URL || DEFAULT_AUTONUKE_GIF_URL).trim();

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(`# ${EMOJIS.bomb} ${moxi.translate('AUTONUKE_TITLE', lang)}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`${moxi.translate('AUTONUKE_DESCRIPTION', lang)}${executedBy}`)
        );

    if (gifUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(gifUrl))
        );
    }

    return container;
};
