#!/usr/bin/env node

/**
 * Script para corregir rutas relativas en comandos migrados
 * Los comandos estaban en Comandos/[Cat]/file.js usando ../../
 * Ahora están en Modules/[Cat]/commands/file.js y necesitan ../../../
 */

const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'Modules');

function fixRequirePath(filePath, content) {
  let fixed = content;
  let changed = false;

  // Patrones a buscar y reemplazar
  const replacements = [
    // De: ../../i18n -> A: ../../../i18n
    { from: /require\(['"]\.\.\/\.\.\/i18n['"]\)/g, to: "require('../../../i18n')" },
    { from: /require\(['"]\.\.\/\.\.\/Util\//g, to: "require('../../../Util/" },
    { from: /require\(['"]\.\.\/\.\.\/Config['"]\)/g, to: "require('../../../Config')" },
    { from: /require\(['"]\.\.\/\.\.\/Slashcmd\//g, to: "require('../../../Slashcmd/" },
    { from: /require\(['"]\.\.\/\.\.\/Functions\//g, to: "require('../../../Functions/" },
    { from: /require\(['"]\.\.\/\.\.\/Embeds\//g, to: "require('../../../Embeds/" },
    { from: /require\(['"]\.\.\/\.\.\/Global\//g, to: "require('../../../Global/" },
    { from: /require\(['"]\.\.\/\.\.\/Models\//g, to: "require('../../../Models/" },
  ];

  replacements.forEach(({ from, to }) => {
    if (from.test(fixed)) {
      fixed = fixed.replace(from, to);
      changed = true;
    }
  });

  return { fixed, changed };
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const { fixed, changed } = fixRequirePath(filePath, content);

    if (changed) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      return true;
    }
    return false;
  } catch (e) {
    console.warn(`  ⚠️  Error procesando ${path.basename(filePath)}: ${e.message}`);
    return false;
  }
}

console.log(`🔧 Corrigiendo rutas relativas en comandos...\n`);

let totalFixed = 0;
let totalErrors = 0;

// Procesar commands/
const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
const modules = entries.filter(e => e.isDirectory());

modules.forEach(moduleDir => {
  const modulePath = path.join(modulesDir, moduleDir.name);
  
  // Procesar /commands
  const commandsDir = path.join(modulePath, 'commands');
  if (fs.existsSync(commandsDir)) {
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
    let moduleFixed = 0;
    
    files.forEach(file => {
      if (processFile(path.join(commandsDir, file))) {
        moduleFixed++;
        totalFixed++;
      }
    });
    
    if (moduleFixed > 0) {
      console.log(`  ✅ ${moduleDir.name}: ${moduleFixed} comandos corregidos`);
    }
  }

  // Procesar /slashcmds
  const slashDir = path.join(modulePath, 'slashcmds');
  if (fs.existsSync(slashDir)) {
    const files = fs.readdirSync(slashDir).filter(f => f.endsWith('.js'));
    let moduleFixed = 0;
    
    files.forEach(file => {
      if (processFile(path.join(slashDir, file))) {
        moduleFixed++;
        totalFixed++;
      }
    });
    
    if (moduleFixed > 0) {
      console.log(`  ✅ ${moduleDir.name}: ${moduleFixed} slash commands corregidos`);
    }
  }

  // Procesar /events
  const eventsDir = path.join(modulePath, 'events');
  if (fs.existsSync(eventsDir)) {
    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
    let moduleFixed = 0;
    
    files.forEach(file => {
      if (processFile(path.join(eventsDir, file))) {
        moduleFixed++;
        totalFixed++;
      }
    });
    
    if (moduleFixed > 0) {
      console.log(`  ✅ ${moduleDir.name}: ${moduleFixed} eventos corregidos`);
    }
  }
});

console.log(`\n✅ Total: ${totalFixed} archivos corregidos`);
if (totalErrors > 0) {
  console.log(`⚠️  ${totalErrors} errores encontrados`);
}
