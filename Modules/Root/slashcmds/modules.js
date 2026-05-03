/**
 * Comando Admin para gestionar módulos
 * Localización: Modules/Root/slashcmds/modules.js
 * 
 * Uso:
 * /modules list - Ver todos los módulos
 * /modules info <módulo> - Info detallada de un módulo
 * /modules reload <módulo> - Recargar un módulo
 * /modules stats - Estadísticas generales
 */

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { isDiscordOnlyOwner } = require('../../../Util/ownerPermissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modules')
    .setDescription('Gestionar módulos del bot (solo owner)')
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Ver lista de todos los módulos cargados')
    )
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Ver información detallada de un módulo')
        .addStringOption(opt =>
          opt
            .setName('module')
            .setDescription('Nombre del módulo')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reload')
        .setDescription('Recargar un módulo')
        .addStringOption(opt =>
          opt
            .setName('module')
            .setDescription('Nombre del módulo a recargar')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stats')
        .setDescription('Ver estadísticas de módulos')
    ),

  async run(client, interaction) {
    const isOwner = await isDiscordOnlyOwner({ client, userId: interaction.user.id });
    if (!isOwner) {
      return interaction.reply({
        content: '❌ Solo el propietario del bot puede usar este comando.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const moduleLoader = client.moduleLoader;

    if (!moduleLoader) {
      return interaction.reply({
        content: '❌ El sistema modular no está inicializado.',
        ephemeral: true
      });
    }

    if (subcommand === 'list') {
      const modules = moduleLoader.listModules();
      
      if (modules.length === 0) {
        return interaction.reply('No hay módulos cargados.');
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📦 Módulos Cargados')
        .setDescription(modules.length + ' módulos disponibles')
        .addFields(
          modules.map(m => ({
            name: `${m.name} v${m.version}`,
            value: `📝 ${m.commands} cmds | ⚡ ${m.slashCommands} slash | 📡 ${m.events} eventos\n${m.description}`,
            inline: false
          }))
        )
        .setFooter({ text: 'Sistema Modular' });

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'info') {
      const moduleName = interaction.options.getString('module');
      const module = moduleLoader.getModule(moduleName);

      if (!module) {
        return interaction.reply({
          content: `❌ Módulo "${moduleName}" no encontrado.`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`📦 ${module.name}`)
        .addFields([
          { name: 'Versión', value: module.version, inline: true },
          { name: 'Estado', value: '✅ Cargado', inline: true },
          { name: 'Descripción', value: module.description || 'Sin descripción' },
          { name: 'Comandos Prefix', value: module.commands.length.toString(), inline: true },
          { name: 'Slash Commands', value: module.slashCommands.length.toString(), inline: true },
          { name: 'Eventos', value: module.events.length.toString(), inline: true }
        ])
        .setFooter({ text: `Ruta: ${module.path}` });

      if (module.commands.length > 0) {
        const cmdNames = module.commands.map(c => `\`${c.file.replace('.js', '')}\``).join(', ');
        embed.addFields([
          { name: 'Comandos', value: cmdNames }
        ]);
      }

      if (module.slashCommands.length > 0) {
        const slashNames = module.slashCommands.map(c => `\`/${c.file.replace('.js', '')}\``).join(', ');
        embed.addFields([
          { name: 'Slash Commands', value: slashNames }
        ]);
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'reload') {
      const moduleName = interaction.options.getString('module');

      await interaction.deferReply();

      const reloaded = moduleLoader.reloadModule(moduleName);

      if (!reloaded) {
        return interaction.editReply({
          content: `❌ Error recargando módulo "${moduleName}".`
        });
      }

      return interaction.editReply({
        content: `✅ Módulo "${moduleName}" recargado exitosamente.\n📝 Comandos: ${reloaded.commands.length} | ⚡ Slash: ${reloaded.slashCommands.length} | 📡 Eventos: ${reloaded.events.length}`
      });
    }

    if (subcommand === 'stats') {
      const stats = moduleLoader.getStats();

      const embed = new EmbedBuilder()
        .setColor(0xFAA81A)
        .setTitle('📊 Estadísticas de Módulos')
        .addFields([
          { name: '📦 Módulos Cargados', value: stats.modulesCount.toString(), inline: true },
          { name: '🔧 Comandos Prefix', value: stats.totalCommands.toString(), inline: true },
          { name: '⚡ Slash Commands', value: stats.totalSlashCommands.toString(), inline: true },
          { name: '📡 Eventos', value: stats.totalEvents.toString(), inline: true },
          { name: '❌ Errores', value: stats.errorCount.toString(), inline: true }
        ])
        .setFooter({ text: 'Sistema Modular' });

      return interaction.reply({ embeds: [embed] });
    }
  }
};
