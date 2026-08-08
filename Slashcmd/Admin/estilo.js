const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const {
    refreshSeasonStyle,
    updateSeasonStyle,
    normalizeSeasonInput,
    normalizeHemisphereInput,
    formatSeasonStatus,
} = require('../../Util/seasonStyle');

function buildStatusText(view) {
    return [
        `Modo: **${view.modeText}**`,
        `Estacion activa: **${view.active}**`,
        `Estacion manual: **${view.manual}**`,
        `Hemisferio: **${view.hemisphere}**`,
        `Color activo: **${view.color}**`,
    ].join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('estilo')
        .setDescription('Configura el estilo estacional global del bot')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub.setName('estado')
                .setDescription('Muestra el estado actual del estilo estacional')
        )
        .addSubcommand((sub) =>
            sub.setName('auto')
                .setDescription('Activa el modo automatico por estacion')
        )
        .addSubcommand((sub) =>
            sub.setName('manual')
                .setDescription('Fija una estacion manualmente')
                .addStringOption((opt) =>
                    opt.setName('estacion')
                        .setDescription('Estacion a usar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Primavera', value: 'primavera' },
                            { name: 'Verano', value: 'verano' },
                            { name: 'Otono', value: 'otono' },
                            { name: 'Invierno', value: 'invierno' }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub.setName('hemisferio')
                .setDescription('Define el hemisferio para el calculo automatico')
                .addStringOption((opt) =>
                    opt.setName('valor')
                        .setDescription('Norte o sur')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Norte', value: 'north' },
                            { name: 'Sur', value: 'south' }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub.setName('off')
                .setDescription('Desactiva el estilo estacional y usa el color base')
        )
        .addSubcommand((sub) =>
            sub.setName('actualizar')
                .setDescription('Recalcula y aplica el estilo ahora mismo')
        ),

    async run(_Moxi, interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'estado') {
            const snapshot = await refreshSeasonStyle();
            const view = formatSeasonStatus(snapshot);
            return interaction.reply({ content: buildStatusText(view), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        }

        if (sub === 'auto') {
            const snapshot = await updateSeasonStyle({ mode: 'auto' }, { id: interaction.user?.id, tag: interaction.user?.tag });
            const view = formatSeasonStatus(snapshot);
            return interaction.reply({ content: `Modo automatico activado.\n${buildStatusText(view)}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        }

        if (sub === 'off') {
            const snapshot = await updateSeasonStyle({ mode: 'off' }, { id: interaction.user?.id, tag: interaction.user?.tag });
            const view = formatSeasonStatus(snapshot);
            return interaction.reply({ content: `Estilo estacional desactivado.\n${buildStatusText(view)}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        }

        if (sub === 'manual') {
            const season = normalizeSeasonInput(interaction.options.getString('estacion', true));
            if (!season) {
                return interaction.reply({ content: 'Estacion invalida.', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
            }
            const snapshot = await updateSeasonStyle({ mode: 'manual', manualSeason: season }, { id: interaction.user?.id, tag: interaction.user?.tag });
            const view = formatSeasonStatus(snapshot);
            return interaction.reply({ content: `Modo manual aplicado.\n${buildStatusText(view)}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        }

        if (sub === 'hemisferio') {
            const hemisphere = normalizeHemisphereInput(interaction.options.getString('valor', true));
            if (!hemisphere) {
                return interaction.reply({ content: 'Hemisferio invalido.', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
            }
            const snapshot = await updateSeasonStyle({ hemisphere }, { id: interaction.user?.id, tag: interaction.user?.tag });
            const view = formatSeasonStatus(snapshot);
            return interaction.reply({ content: `Hemisferio actualizado.\n${buildStatusText(view)}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        }

        const snapshot = await refreshSeasonStyle();
        const view = formatSeasonStatus(snapshot);
        return interaction.reply({ content: `Estilo recalculado.\n${buildStatusText(view)}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    },
};
