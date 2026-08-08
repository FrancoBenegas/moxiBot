/**
 * Handler de Slash Commands Modulares
 * Carga slash commands desde los módulos
 */

const logger = require('../Util/logger');

module.exports = async (client, moduleLoader) => {
  if (!moduleLoader || moduleLoader.modules.size === 0) {
    logger.warn('⚠️  No hay módulos cargados o moduleLoader no disponible');
    return;
  }

  let totalSlashCommands = 0;

  for (const [moduleName, module] of moduleLoader.modules) {
    for (const { file, handler } of module.slashCommands) {
      try {
        if (!handler.data || !handler.data.name) {
          logger.warn(`[${moduleName}] Slash command ${file} sin propiedad "data.name"`);
          continue;
        }

        client.slashcommands.set(handler.data.name, handler);
        totalSlashCommands++;
      } catch (e) {
        logger.error(`[${moduleName}] Error registrando slash command ${file}: ${e.message}`);
      }
    }
  }

  logger.startup(`⚡ ${totalSlashCommands} slash commands registrados desde módulos`);
};
