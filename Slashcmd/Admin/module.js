const {
    PermissionFlagsBits,
    ContainerBuilder,
    MessageFlags,
} = require('discord.js');

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { setGuildModuleEnabled, getGuildSettingsCached } = require('../../Util/guildSettings');

const MODULE_CHOICES = [
    { name: 'welcome', value: 'welcome' },
    { name: 'roleplay', value: 'roleplay' },
    { name: 'economy', value: 'economy' },
    { name: 'utilities', value: 'utilities' },
    { name: 'moderation', value: 'moderation' },
    { name: 'music', value: 'music' },
    { name: 'ai', value: 'ai' },
    { name: 'giveaways', value: 'giveaways' },
    { name: 'tickets', value: 'tickets' },
    { name: 'logs', value: 'logs' },
    { name: 'automod', value: 'automod' },
    { name: 'wiki', value: 'wiki' },
    { name: 'voice', value: 'voice' },
    { name: 'fun', value: 'fun' },
    { name: 'administration', value: 'administration' },
    { name: 'systems', value: 'systems' },
    { name: 'streaming', value: 'streaming' },
    { name: 'genshin', value: 'genshin' },
    { name: 'matrimonio', value: 'matrimonio' },
];

function buildPanel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body))
        .addSeparatorComponents(s => s.setDivider(true));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

module.exports = {
    cooldown: 5,
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ADMIN', lang),

    data: new SlashCommandBuilder()
        .setName('module')
        .setDescription('Activa o desactiva un módulo del servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Activar o desactivar un módulo')
                .addStringOption(o =>
                    o.setName('modulo')
                        .setDescription('Nombre del módulo')
                        .setRequired(true)
                        .addChoices(...MODULE_CHOICES)
                )
                .addBooleanOption(o =>
                    o.setName('estado')
                        .setDescription('true = activar | false = desactivar')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Ver el estado de todos los módulos')
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        if (!guildId) return interaction.reply({ content: 'Solo disponible en servidores.', ephemeral: true });

        if (!interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Necesitas permisos de Administrador.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
            const settings = await getGuildSettingsCached(guildId).catch(() => null);
            const states = (settings?.ModuleStates && typeof settings.ModuleStates === 'object')
                ? settings.ModuleStates
                : {};
            const lines = Object.entries(states).map(([id, enabled]) =>
                `${enabled === false ? '🔴' : '🟢'} \`${id}\``
            );
            const body = lines.length ? lines.join('\n') : '_Todos los módulos están activos (sin overrides)._';
            return interaction.editReply(buildPanel({ title: '📦 Estado de módulos', body }));
        }

        // sub === 'set'
        const moduleId = interaction.options.getString('modulo');
        const enabled = interaction.options.getBoolean('estado');

        const ok = await setGuildModuleEnabled(guildId, moduleId, enabled).catch(() => false);
        if (!ok) {
            return interaction.editReply(buildPanel({ title: '❌ Error', body: 'No se pudo guardar el cambio.' }));
        }

        return interaction.editReply(buildPanel({
            title: '📦 Módulo actualizado',
            body: `El módulo \`${moduleId}\` ha sido ${enabled ? '🟢 **activado**' : '🔴 **desactivado**'}.`,
        }));
    },
};
