#!/usr/bin/env node

/**
 * Script para sincronizar solo comandos modulares a MongoDB
 * Limpia los comandos legacy y deja solo los módulos
 */

require('../Util/silentDotenv')();

const path = require('path');
const fs = require('fs');
const logger = require('../Util/logger');
const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
const { syncCommandRegistry } = require('../Util/commandRegistry');
const { normalizeDiscordId } = require('../Util/idGuards');

// Dummy client para cargar módulos
class DummyClient {
  constructor(botId) {
    this.commands = new Map();
    this.slashcommands = new Map();
    this.user = { id: botId };
    this.moduleLoader = null;
  }
}

async function main() {
  if (!process.env.MONGODB) {
    console.error('Falta MONGODB en el entorno/.env');
    process.exit(1);
  }

  const botId = normalizeDiscordId(process.env.CLIENT_ID || process.env.BOT_ID || process.env.APPLICATION_ID) || 'local-script';
  
  console.log(`[ModuleSync] Usando botId: ${botId}`);

  const client = new DummyClient(botId);

  // Cargar módulos
  console.log('[ModuleSync] Cargando módulos...');
  
  try {
    const ModuleLoader = require('../Modules/loader');
    const moduleLoader = new ModuleLoader(client);
    moduleLoader.loadAllModules();
    client.moduleLoader = moduleLoader;

    // Registrar comandos en client.commands
    for (const [moduleName, module] of moduleLoader.modules) {
      for (const { handler } of module.commands) {
        if (handler && handler.name) {
          client.commands.set(handler.name, handler);
        }
      }
      for (const { handler } of module.slashCommands) {
        if (handler && handler.data && handler.data.name) {
          client.slashcommands.set(handler.data.name, handler);
        }
      }
    }

    console.log(`[ModuleSync] ✅ Módulos cargados: ${moduleLoader.modules.size}`);
    console.log(`[ModuleSync] ✅ Comandos de prefijo: ${client.commands.size}`);
    console.log(`[ModuleSync] ✅ Slash commands: ${client.slashcommands.size}`);
  } catch (e) {
    console.error('[ModuleSync] Error cargando módulos:', e.message);
    process.exit(1);
  }

  // Conectar a MongoDB
  await ensureMongoConnection();

  // Purgar comandos legacy (botId)
  try {
    console.log(`[ModuleSync] Purgando comandos legacy del botId: ${botId}`);
    const CommandRegistry = require('../Models/CommandsSchema');
    const Subcommands = require('../Models/SubcommandsSchema');
    
    const { deletedCount } = await CommandRegistry.deleteMany({ botId });
    const { deletedCount: subDeletedCount } = await Subcommands.deleteMany({ botId });
    
    console.log(`[ModuleSync] ✅ Eliminados: ${deletedCount} comandos, ${subDeletedCount} subcomandos`);
  } catch (e) {
    console.warn('[ModuleSync] Advertencia al purgar:', e.message);
  }

  // Sincronizar solo comandos modulares
  console.log('[ModuleSync] Sincronizando comandos modulares con MongoDB...');
  
  try {
    const res = await syncCommandRegistry(client, { enabled: true, deleteMissing: true });
    
    if (res && res.ok) {
      console.log('[ModuleSync] ✅ OK: CommandRegistry sincronizado exitosamente');
    } else {
      console.warn('[ModuleSync] ⚠️  CommandRegistry no se sincronizó correctamente');
    }
  } catch (e) {
    console.error('[ModuleSync] Error sincronizando:', e.message);
    process.exit(1);
  }

  await mongoose.disconnect().catch(() => null);
  console.log('[ModuleSync] ✅ Script completado');
  process.exit(0);
}

main().catch((e) => {
  console.error('[ModuleSync] Error fatal:', e);
  process.exit(1);
});
