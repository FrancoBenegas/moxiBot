/**
 * Handler de Comandos Modulares
 * Carga comandos de prefijo desde los módulos
 */

const fs = require('fs');
const path = require('path');
const logger = require('../Util/logger');

module.exports = async (client, moduleLoader) => {
  if (!moduleLoader || moduleLoader.modules.size === 0) {
    logger.warn('⚠️  No hay módulos cargados o moduleLoader no disponible');
    return;
  }

  let totalCommands = 0;

  for (const [moduleName, module] of moduleLoader.modules) {
    for (const { file, handler } of module.commands) {
      try {
        if (!handler.name) {
          logger.warn(`[${moduleName}] Comando ${file} sin propiedad "name"`);
          continue;
        }

        client.commands.set(handler.name, handler);
        
        // Registrar aliases
        if (handler.alias && Array.isArray(handler.alias)) {
          handler.alias.forEach(a => client.commands.set(a, handler));
        }

        totalCommands++;
      } catch (e) {
        logger.error(`[${moduleName}] Error registrando comando ${file}: ${e.message}`);
      }
    }
  }

  logger.startup(`🔧 ${totalCommands} comandos de prefijo registrados desde módulos`);
};
