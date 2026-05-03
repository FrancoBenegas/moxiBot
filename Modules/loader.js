/**
 * Module Loader Sistema
 * Carga dinámicamente módulos desde la carpeta Modules/
 * Cada módulo debe tener un module.json y estructura específica
 */

const fs = require('fs');
const path = require('path');
const logger = require('../Util/logger');

class ModuleLoader {
  constructor(client) {
    this.client = client;
    this.modules = new Map();
    this.moduleErrors = [];
  }

  /**
   * Valida que un módulo tenga la estructura correcta
   */
  validateModule(modulePath) {
    const issues = [];
    
    const moduleJsonPath = path.join(modulePath, 'module.json');
    if (!fs.existsSync(moduleJsonPath)) {
      issues.push('Falta module.json');
      return issues;
    }

    try {
      const meta = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
      if (!meta.name) issues.push('Falta "name" en module.json');
      if (!meta.version) issues.push('Falta "version" en module.json');
      if (meta.enabled === undefined) meta.enabled = true;
    } catch (e) {
      issues.push(`module.json inválido: ${e.message}`);
    }

    return issues;
  }

  /**
   * Carga un único módulo
   */
  loadModule(moduleName) {
    const modulePath = path.join(__dirname, moduleName);

    if (!fs.existsSync(modulePath)) {
      const msg = `Módulo no encontrado: ${moduleName}`;
      logger.warn(msg);
      this.moduleErrors.push(msg);
      return null;
    }

    // Validar estructura
    const issues = this.validateModule(modulePath);
    if (issues.length > 0) {
      const msg = `Módulo ${moduleName} inválido: ${issues.join(', ')}`;
      logger.warn(msg);
      this.moduleErrors.push(msg);
      return null;
    }

    try {
      const moduleJsonPath = path.join(modulePath, 'module.json');
      const meta = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));

      // Si está deshabilitado, skipear
      if (meta.enabled === false) {
        logger.info(`⏭️  Módulo deshabilitado: ${moduleName}`);
        return null;
      }

      const module = {
        name: meta.name,
        version: meta.version,
        description: meta.description || '',
        path: modulePath,
        meta,
        commands: [],
        slashCommands: [],
        events: []
      };

      const rootJsFiles = fs.readdirSync(modulePath)
        .filter(f => f.endsWith('.js') && f !== 'module.json');

      const seenPrefix = new Set();
      const seenSlash = new Set();

      const registerCommand = (cmd, fileTag) => {
        if (!cmd || typeof cmd !== 'object') return;
        if (cmd.name) {
          const key = String(cmd.name).trim().toLowerCase();
          if (key && !seenPrefix.has(key)) {
            module.commands.push({ file: fileTag, handler: cmd });
            seenPrefix.add(key);
          }
        }
        if (cmd.data?.name) {
          const key = String(cmd.data.name).trim().toLowerCase();
          if (key && !seenSlash.has(key)) {
            module.slashCommands.push({ file: fileTag, handler: cmd });
            seenSlash.add(key);
          }
        }
      };

      // 1) Archivos .js en la raíz del módulo (formato plano)
      for (const file of rootJsFiles) {
        try {
          const mod = require(path.join(modulePath, file));
          registerCommand(mod, file);
        } catch (e) {
          logger.warn(`[${moduleName}] Error cargando archivo ${file}: ${e.message}`);
        }
      }

      // 2) Subcarpeta commands/ (comandos de prefijo)
      const commandsPath = path.join(modulePath, 'commands');
      if (fs.existsSync(commandsPath)) {
        for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
          try {
            const cmd = require(path.join(commandsPath, file));
            registerCommand(cmd, `commands/${file}`);
          } catch (e) {
            logger.warn(`[${moduleName}] Error cargando comando ${file}: ${e.message}`);
          }
        }
      }

      // 3) Subcarpeta slashcmds/ (slash commands)
      const slashPath = path.join(modulePath, 'slashcmds');
      if (fs.existsSync(slashPath)) {
        for (const file of fs.readdirSync(slashPath).filter(f => f.endsWith('.js'))) {
          try {
            const cmd = require(path.join(slashPath, file));
            registerCommand(cmd, `slashcmds/${file}`);
          } catch (e) {
            logger.warn(`[${moduleName}] Error cargando slash command ${file}: ${e.message}`);
          }
        }
      }

      this.modules.set(moduleName, module);
      logger.startup(`✅ Módulo cargado: ${moduleName} v${meta.version} (${module.commands.length} cmds, ${module.slashCommands.length} slash, ${module.events.length} eventos)`);
      return module;
    } catch (e) {
      const msg = `Error cargando módulo ${moduleName}: ${e.message}`;
      logger.error(msg);
      this.moduleErrors.push(msg);
      return null;
    }
  }

  /**
   * Carga todos los módulos disponibles
   */
  loadAllModules() {
    const modulesDir = __dirname;
    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    const moduleNames = entries
      .filter(e => e.isDirectory() && e.name !== 'node_modules' && e.name !== '.')
      .map(e => e.name);

    logger.divider();
    logger.startup(`📦 Cargando ${moduleNames.length} módulos...`);
    logger.divider();

    for (const moduleName of moduleNames) {
      this.loadModule(moduleName);
    }

    logger.divider();
    logger.startup(`✅ ${this.modules.size} módulos cargados exitosamente`);
    if (this.moduleErrors.length > 0) {
      logger.warn(`⚠️  ${this.moduleErrors.length} errores durante carga de módulos:`);
      this.moduleErrors.forEach(e => logger.warn(`  - ${e}`));
    }
    logger.divider();

    return this.modules;
  }

  /**
   * Obtiene estadísticas de los módulos cargados
   */
  getStats() {
    let totalCmds = 0;
    let totalSlash = 0;
    let totalEvents = 0;

    for (const mod of this.modules.values()) {
      totalCmds += mod.commands.length;
      totalSlash += mod.slashCommands.length;
      totalEvents += mod.events.length;
    }

    return {
      modulesCount: this.modules.size,
      totalCommands: totalCmds,
      totalSlashCommands: totalSlash,
      totalEvents: totalEvents,
      errorCount: this.moduleErrors.length
    };
  }

  /**
   * Lista todos los módulos cargados
   */
  listModules() {
    const list = [];
    for (const [name, mod] of this.modules) {
      list.push({
        name: mod.name,
        version: mod.version,
        description: mod.description,
        commands: mod.commands.length,
        slashCommands: mod.slashCommands.length,
        events: mod.events.length
      });
    }
    return list;
  }

  /**
   * Obtiene un módulo específico
   */
  getModule(moduleName) {
    return this.modules.get(moduleName);
  }

  /**
   * Recarga un módulo específico
   */
  reloadModule(moduleName) {
    logger.info(`🔄 Recargando módulo ${moduleName}...`);
    
    // Limpiar require cache
    const modulePath = path.join(__dirname, moduleName);
    Object.keys(require.cache).forEach(key => {
      if (key.startsWith(modulePath)) {
        delete require.cache[key];
      }
    });

    this.modules.delete(moduleName);
    const reloaded = this.loadModule(moduleName);
    
    if (reloaded) {
      logger.startup(`✅ Módulo recargado: ${moduleName}`);
    } else {
      logger.error(`❌ Error recargando módulo: ${moduleName}`);
    }
    
    return reloaded;
  }
}

module.exports = ModuleLoader;
