const {
    ActionRowBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const { ButtonBuilder } = require('../../Util/compatButtonBuilder');

const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { formatStudioFooter, formatSessionEndedFooter } = require('../../Util/seasonBrand');

// Sin placeholder: si no hay imagen, el container no mostrará MediaGallery.
const FALLBACK_IMG = String(process.env.MUSIC_FALLBACK_IMAGE_URL || '').trim();

const CONTROL_EMOJIS = {
    repit: EMOJIS.Icon,
    pause: EMOJIS.pause1,
    skip: EMOJIS.icon,
    queue: EMOJIS.queue,
    autoplay: EMOJIS.infinito,
    stop: EMOJIS.stopSign,
};

function buildMusicControlsRow({ disabled = false } = {}) {
    const suffix = disabled ? '_d' : '';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`repit${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.repit)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`pause${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.pause)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`skip${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.skip)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`queue${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.queue)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`autoplay${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.autoplay)
            .setDisabled(disabled)
    );
}

function buildMusicVolumeRow({ disabled = false } = {}) {
    const suffix = disabled ? '_d' : '';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`seek_back${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('-10s')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`vol_down${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.volDown)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`vol_up${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.volUp)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`seek_forward${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('+10s')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`stop${suffix}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji(CONTROL_EMOJIS.stop)
            .setDisabled(disabled)
    );
}

function buildMusicFilterRow({ disabled = false, activeFilter = null } = {}) {
    const active = typeof activeFilter === 'string' ? activeFilter.trim().toLowerCase() : null;
    const options = [
        { label: 'OFF', description: 'Desactiva todos los filtros', value: 'off' },
        { label: 'BASS BOOST', description: 'Potencia los graves', value: 'bassboost' },
        { label: 'NIGHTCORE', description: 'Pitch y velocidad altos', value: 'nightcore' },
        { label: 'VAPORWAVE', description: 'Pitch y velocidad bajos', value: 'vaporwave' },
        { label: '8D AUDIO', description: 'Efecto de audio rotatorio 3D', value: '8d' },
        { label: 'SLOW MODE', description: 'Reproduce mas lento', value: 'slowmode' },
        { label: 'KARAOKE', description: 'Reduce la voz central', value: 'karaoke' },
        { label: 'TREMOLO', description: 'Vibracion de volumen', value: 'tremolo' },
        { label: 'VIBRATO', description: 'Vibracion de pitch', value: 'vibrato' },
    ].map((opt) => (active === opt.value ? { ...opt, default: true } : opt));

    const menu = new StringSelectMenuBuilder()
        .setCustomId('music_filter')
        .setPlaceholder('Filtro de audio')
        .setDisabled(disabled)
        .addOptions(options);

    return new ActionRowBuilder().addComponents(menu);
}

function buildDisabledMusicSessionContainer({ title, info, imageUrl, footerText } = {}) {
    let safeImageUrl = imageUrl;
    if (!safeImageUrl || typeof safeImageUrl !== 'string' || safeImageUrl.startsWith('attachment://')) {
        safeImageUrl = FALLBACK_IMG;
    }

    const resolvedTitle = title || '';
    const resolvedInfo = info || '';
    const resolvedFooterText = footerText || formatSessionEndedFooter();

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedTitle));

    if (safeImageUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(safeImageUrl))
        );
    }

    container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedInfo))
        .addActionRowComponents(buildMusicControlsRow({ disabled: true }))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(buildMusicFilterRow({ disabled: true }))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(buildMusicVolumeRow({ disabled: true }))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedFooterText));

    return container;
}

function buildActiveMusicSessionContainer({ title, info, imageUrl, footerText, activeFilter = null } = {}) {
    let safeImageUrl = imageUrl;
    // En panel activo permitimos attachment:// porque se edita el mensaje con el archivo dinámico
    // y así la barra de progreso de la card se actualiza correctamente.
    if (!safeImageUrl || typeof safeImageUrl !== 'string') {
        safeImageUrl = FALLBACK_IMG;
    }

    const resolvedTitle = title || '';
    const resolvedInfo = info || '';
    const resolvedFooterText = footerText || formatStudioFooter();

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedTitle))
        .addSeparatorComponents(new SeparatorBuilder());

    if (safeImageUrl) {
        container
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(safeImageUrl))
            )
            .addSeparatorComponents(new SeparatorBuilder());
    }

    container
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedInfo))
        .addActionRowComponents(buildMusicControlsRow({ disabled: false }))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(buildMusicFilterRow({ disabled: false, activeFilter }))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(buildMusicVolumeRow({ disabled: false }))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedFooterText));

    return container;
}

module.exports = {
    buildMusicControlsRow,
    buildMusicFilterRow,
    buildMusicVolumeRow,
    buildDisabledMusicSessionContainer,
    buildActiveMusicSessionContainer,
};
