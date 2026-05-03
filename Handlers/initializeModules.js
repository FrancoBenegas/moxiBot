/**
 * Integración del Sistema Modular
 * Se ejecuta después de que los handlers básicos estén cargados
 * 
 * Esto inicializa:
 * 1. ModuleLoader
 * 2. Carga todos los módulos
 * 3. Registra comandos, slash commands y eventos desde módulos
 */

const ModuleLoader = require('../Modules/loader');
const logger = require('../Util/logger');

module.exports = async (client) => {
  try {
    logger.divider();
    logger.startup('🔄 Inicializando Sistema Modular...');
    logger.divider();

    // Crear instancia del loader
    const moduleLoader = new ModuleLoader(client);
    
    // Guardar referencia en el cliente para acceso global
    client.moduleLoader = moduleLoader;

    // Cargar todos los módulos
    moduleLoader.loadAllModules();

    // Registrar comandos de prefijo desde módulos
    const loadModuleCommands = require('./moduleCommands');
    await loadModuleCommands(client, moduleLoader);

    // Registrar slash commands desde módulos
    const loadModuleSlashCommands = require('./moduleSlashCommands');
    await loadModuleSlashCommands(client, moduleLoader);

    // Registrar eventos desde módulos
    const loadModuleEvents = require('./moduleEvents');
    await loadModuleEvents(client, moduleLoader);

    // Mostrar estadísticas
    const stats = moduleLoader.getStats();
    logger.divider();
    logger.startup(`📊 Sistema Modular Inicializado:`);
    logger.startup(`   📦 ${stats.modulesCount} módulos cargados`);
    logger.startup(`   🔧 ${stats.totalCommands} comandos de prefijo`);
    logger.startup(`   ⚡ ${stats.totalSlashCommands} slash commands`);
    logger.startup(`   📡 ${stats.totalEvents} eventos`);
    if (stats.errorCount > 0) {
      logger.warn(`   ⚠️  ${stats.errorCount} errores durante carga`);
    }
    logger.divider();

    // Sincronizar CommandRegistry con MongoDB (solo módulos)
    try {
      const { syncCommandRegistry } = require('../Util/commandRegistry');
      syncCommandRegistry(client, { enabled: true, deleteMissing: true })
        .then(res => {
          if (res && res.ok) logger.startup('✅ CommandRegistry sincronizado con módulos');
          else logger.warn('⚠️  CommandRegistry: sync parcial');
        })
        .catch(e => logger.warn('⚠️  CommandRegistry sync falló:', e.message));
    } catch (e) {
      logger.warn('⚠️  CommandRegistry no disponible:', e.message);
    }

    return moduleLoader;
  } catch (e) {
    logger.error('❌ Error inicializando sistema modular:', e);
    return null;
  }
};
