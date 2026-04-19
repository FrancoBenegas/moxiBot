const { MessageFlags } = require('discord.js');
const moxi = require('../../../../i18n');
const { renderActiveMusicPanel, setMusicPanelMessage } = require('../../../../Util/musicPanelAutoUpdater');

function buildBassboostEqualizer(level = 4) {
    const num = (level - 1) * (1.25 / 9) - 0.25;
    return Array.from({ length: 13 }, (_, band) => ({ band, gain: num }));
}

function getFilterPayload(filterKey) {
    switch (filterKey) {
        case 'off':
            return {};
        case 'bassboost':
            return { equalizer: buildBassboostEqualizer(4) };
        case 'nightcore':
            return { timescale: { rate: 1.5 } };
        case 'vaporwave':
            return { timescale: { pitch: 0.5 } };
        case '8d':
            return { rotation: { rotationHz: 0.2 } };
        case 'slowmode':
            return { timescale: { speed: 0.5, pitch: 1.0, rate: 0.8 } };
        case 'karaoke':
            return { karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } };
        case 'tremolo':
            return { tremolo: { frequency: 2.0, depth: 0.5 } };
        case 'vibrato':
            return { vibrato: { frequency: 14.0, depth: 1.0 } };
        default:
            return null;
    }
}

async function applyFilterCompat(filters, filterKey) {
    const payload = getFilterPayload(filterKey);
    if (!payload) throw new Error(`Unsupported filter key: ${filterKey}`);
    const nextState = {
        equalizer: [],
        karaoke: undefined,
        timescale: undefined,
        tremolo: undefined,
        vibrato: undefined,
        rotation: undefined,
        distortion: undefined,
        channelMix: undefined,
        lowPass: undefined,
    };

    Object.assign(nextState, payload || {});

    if (typeof filters?.updateFilters === 'function') {
        Object.assign(filters, nextState);
        await filters.updateFilters();
        return;
    }

    if (typeof filters?.setFilters !== 'function') {
        throw new Error('No hay API compatible para aplicar filtros en este player');
    }
    await filters.setFilters(nextState);
}

function getNotice(text) {
    return {
        content: String(text || ''),
        flags: MessageFlags.Ephemeral,
    };
}

module.exports = async function musicFilterSelectMenu(interaction, Moxi) {
    if (!interaction.isStringSelectMenu()) return false;
    if (String(interaction.customId || '') !== 'music_filter') return false;

    const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
    const memberChannel = interaction.member?.voice?.channelId;
    const botChannel = interaction.guild?.members?.me?.voice?.channelId;

    if (!memberChannel) {
        await interaction.reply(getNotice(moxi.translate('MUSIC_JOIN_VOICE', lang)));
        return true;
    }

    if (botChannel && memberChannel !== botChannel) {
        await interaction.reply(getNotice(moxi.translate('MUSIC_SAME_VOICE_CHANNEL', lang)));
        return true;
    }

    const player = Moxi.poru?.players?.get(interaction.guild.id);
    if (!player || !player.isPlaying) {
        await interaction.reply(getNotice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang)));
        return true;
    }

    const selected = String(interaction.values?.[0] || '').trim().toLowerCase();

    try {
        await interaction.deferUpdate();

        let notice = 'Filtros desactivados.';
        if (selected !== 'off') {
            const payload = getFilterPayload(selected);
            if (!payload) {
                await interaction.followUp(getNotice('Filtro no reconocido.'));
                return true;
            }

            await applyFilterCompat(player.filters, selected);
            notice = `Filtro aplicado: ${selected.toUpperCase()}.`;
        } else {
            await applyFilterCompat(player.filters, 'off');
        }

        try { player.set('__moxiActiveFilter', selected); } catch { /* sync, no devuelve promesa */ }

        if (interaction.message) {
            setMusicPanelMessage(player, interaction.message);
            await renderActiveMusicPanel({
                client: Moxi,
                player,
                message: interaction.message,
                extraLine: notice,
                force: true,
            });
        }

        await interaction.followUp(getNotice(notice));
        return true;
    } catch (error) {
        const message = error?.message || error;
        console.error('[MUSIC PANEL FILTER] Error aplicando filtro:', message);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(getNotice('Error al aplicar el filtro. Intenta de nuevo.')).catch(() => null);
        } else {
            await interaction.followUp(getNotice('Error al aplicar el filtro. Intenta de nuevo.')).catch(() => null);
        }
        return true;
    }
};
