/**
 * Handler de Eventos Modulares
 * Carga eventos desde los módulos
 */

const logger = require('../Util/logger');

module.exports = async (client, moduleLoader) => {
  if (!moduleLoader || moduleLoader.modules.size === 0) {
    logger.warn('⚠️  No hay módulos cargados o moduleLoader no disponible');
    return;
  }

  let totalEvents = 0;

  for (const [moduleName, module] of moduleLoader.modules) {
    for (const { file, handler } of module.events) {
      try {
        if (typeof handler !== 'function') {
          logger.warn(`[${moduleName}] Evento ${file} no es una función`);
          continue;
        }

        // El archivo del evento debe exportar una función que reciba (client) o (client, moduleLoader)
        handler(client, moduleLoader);
        totalEvents++;
      } catch (e) {
        logger.error(`[${moduleName}] Error registrando evento ${file}: ${e.message}`);
      }
    }
  }

  logger.startup(`📡 ${totalEvents} eventos registrados desde módulos`);
};
