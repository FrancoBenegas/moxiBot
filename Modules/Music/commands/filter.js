/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📊 DURANDAL EQUINOX - FILTROS CLOUBSTER Y LAVALINK
 * Sistema de filtros de audio para la música, utilizando las capacidades de Poru y Lavalink.
 * 
 * Mejora Para Moxi
 * 
 * Power By EmpyreaCloud & Durandal Equinox Team
 * Developed by: EmpyreaCloud
 * Version: 10.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');
const moxi = require('../../../i18n');

const PANEL_COLOR = 0x5DF2B7;
const ERROR_COLOR = 0xFF0000;
const MENU_TIMEOUT = 60_000;

const FILTERS = [
    {
        value: 'bassboost',
        label: 'BASS BOOST',
        description: 'Potencia los graves',
    },
    {
        value: 'nightcore',
        label: 'NIGHTCORE',
        description: 'Pitch y velocidad altos',
    },
    {
        value: 'vaporwave',
        label: 'VAPORWAVE',
        description: 'Pitch y velocidad bajos',
    },
    {
        value: '8d',
        label: '8D AUDIO',
        description: 'Efecto de audio rotatorio 3D',
    },
    {
        value: 'slowmode',
        label: 'SLOW MODE',
        description: 'Reproduce más lento',
    },
    {
        value: 'karaoke',
        label: 'KARAOKE',
        description: 'Reduce la voz central',
    },
    {
        value: 'tremolo',
        label: 'TREMOLO',
        description: 'Vibración de volumen',
    },
    {
        value: 'vibrato',
        label: 'VIBRATO',
        description: 'Vibración de pitch',
    },
];

const FILTER_MAP = new Map(FILTERS.map((filter) => [filter.value, filter]));

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
    if (!payload) {
        throw new Error(`Unsupported filter key: ${filterKey}`);
    }
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
const FILTER_ALIASES = new Map([
    ['off', 'off'],
    ['none', 'off'],
    ['disable', 'off'],
    ['bass', 'bassboost'],
    ['bassboost', 'bassboost'],
    ['nightcore', 'nightcore'],
    ['vaporwave', 'vaporwave'],
    ['8d', '8d'],
    ['8daudio', '8d'],
    ['slow', 'slowmode'],
    ['slowmode', 'slowmode'],
    ['karaoke', 'karaoke'],
    ['tremolo', 'tremolo'],
    ['vibrato', 'vibrato'],
]);

function buildErrorEmbed(message) {
    return new EmbedBuilder().setColor(ERROR_COLOR).setDescription(message);
}

function buildFilterMenu(customId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder('Selecciona un filtro...')
            .setDisabled(disabled)
            .addOptions([
                { label: 'OFF', description: 'Desactiva todos los filtros', value: 'off' },
                ...FILTERS.map((filter) => ({
                    label: filter.label,
                    description: filter.description,
                    value: filter.value,
                })),
            ])
    );
}

function buildPanelEmbed(activeFilterLabel = 'NINGUNO') {
    return new EmbedBuilder()
        .setColor(PANEL_COLOR)
        .setTitle('Panel de Filtros de Audio')
        .setDescription('Selecciona un filtro para modificar la reproducción actual.')
        .addFields(
            {
                name: 'Estado actual',
                value: `Filtro activo: **${activeFilterLabel}**\nTiempo del panel: **60 segundos**`,
                inline: false,
            },
            ...FILTERS.map((filter) => ({
                name: filter.label,
                value: filter.description,
                inline: true,
            }))
        )
        .setFooter({ text: 'Durandal Equinox // Music System' });
}

function normalizeFilterInput(input) {
    const raw = String(input || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return FILTER_ALIASES.get(raw) || '';
}

function buildFilterHelpText(prefix) {
    const names = FILTERS.map((f) => f.value).join(', ');
    return `Uso: ${prefix}filter <off|filtro>\nFiltros: ${names}`;
}

module.exports = {
    name: 'filter',
    alias: ['filtro', 'filters', 'fx'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_MUSICA', lang);
    },
    usage: 'filter <off|filtro>',
    description: function () {
        return 'Aplica un filtro de audio a la reproducción actual';
    },
    cooldown: 5,

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.').catch(() => (process.env.PREFIX || '.'));

        if (!Moxi.poru) {
            return message.reply({
                embeds: [buildErrorEmbed('Sistema de música no disponible.')]
            });
        }

        const player = Moxi.poru.players.get(guildId);
        if (!player || !player.isPlaying) {
            return message.reply({
                embeds: [buildErrorEmbed('No hay ninguna canción reproduciéndose.')]
            });
        }

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel || voiceChannel.id !== player.voiceChannel) {
            return message.reply({
                embeds: [buildErrorEmbed('Debes estar en el mismo canal de voz que el bot.')]
            });
        }

        const rawSelected = String(args?.[0] || '').trim();
        if (rawSelected) {
            const selected = normalizeFilterInput(rawSelected);
            if (!selected) {
                return message.reply({ embeds: [buildErrorEmbed(`Filtro no reconocido.\n${buildFilterHelpText(prefix)}`)] });
            }

            try {
                if (selected === 'off') {
                    await applyFilterCompat(player.filters, 'off');
                    return message.reply({ content: 'Filtros desactivados.' });
                }

                const selectedFilter = FILTER_MAP.get(selected);
                if (!selectedFilter) {
                    return message.reply({ embeds: [buildErrorEmbed('Filtro no reconocido.')] });
                }

                await applyFilterCompat(player.filters, selectedFilter.value);
                return message.reply({ content: `Filtro **${selectedFilter.label}** aplicado.` });
            } catch (err) {
                console.error('[FILTER CMD] Error aplicando filtro directo:', err.message || err);
                return message.reply({ embeds: [buildErrorEmbed('Error al aplicar el filtro. Intenta de nuevo.')] });
            }
        }

        const menuId = `filter-menu-${requesterId}-${Date.now()}`;

        const msg = await message.reply({
            embeds: [buildPanelEmbed()],
            components: [buildFilterMenu(menuId)],
            allowedMentions: { repliedUser: false, parse: [] },
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: MENU_TIMEOUT,
        });

        collector.on('collect', async (menu) => {
            if (!menu.isStringSelectMenu() || menu.customId !== menuId) return;

            if (menu.user.id !== requesterId) {
                return menu.reply({ content: 'Solo el autor del comando puede usar este menú.', ephemeral: true });
            }

            await menu.deferUpdate().catch(() => {});

            const activePlayer = Moxi.poru.players.get(guildId);
            if (!activePlayer) {
                return menu.followUp({ content: 'El reproductor ya no está activo.', ephemeral: true });
            }

            const selected = menu.values[0];
            try {
                if (selected === 'off') {
                    await applyFilterCompat(activePlayer.filters, 'off');
                    await msg.edit({
                        embeds: [buildPanelEmbed('NINGUNO')],
                        components: [buildFilterMenu(menuId)],
                    });
                    return menu.followUp({ content: 'Filtros desactivados.', ephemeral: true });
                }

                const selectedFilter = FILTER_MAP.get(selected);
                if (!selectedFilter) {
                    return menu.followUp({ content: 'Filtro no reconocido.', ephemeral: true });
                }

                await applyFilterCompat(activePlayer.filters, selectedFilter.value);
                await msg.edit({
                    embeds: [buildPanelEmbed(selectedFilter.label)],
                    components: [buildFilterMenu(menuId)],
                });
                await menu.followUp({ content: `Filtro **${selectedFilter.label}** aplicado.`, ephemeral: true });
            } catch (err) {
                console.error('[FILTER] Error aplicando filtro:', err.message || err);
                await menu.followUp({ content: 'Error al aplicar el filtro. Intenta de nuevo.', ephemeral: true });
            }
        });

        collector.on('end', () => {
            msg.edit({
                embeds: [buildPanelEmbed('PANEL CERRADO')],
                components: [buildFilterMenu(menuId, true)],
            }).catch(() => {});
        });
    }
};
