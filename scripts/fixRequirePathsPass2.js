#!/usr/bin/env node

/**
 * Script para corregir rutas específicas faltantes
 * Busca patrones de rutas que no fueron capturadas en el pase anterior
 */

const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'Modules');

const replacements = [
  // Languages
  { from: /require\(['"]\.\.\/Languages\/language-meta/g, to: "require('../../../Languages/language-meta" },
  
  // i18n.js sin extensión
  { from: /require\(['"]\.\.\/i18n\.js['"]\)/g, to: "require('../../../i18n.js')" },
  { from: /require\(['"]\.\.\/i18n['"]\)/g, to: "require('../../../i18n')" },
  
  // Components
  { from: /require\(['"]\.\.\/Components\//g, to: "require('../../../Components/" },
  
  // Config.js
  { from: /require\(['"]\.\.\/Config\.js['"]\)/g, to: "require('../../../Config.js')" },
  { from: /require\(['"]\.\.\/Config['"]\)/g, to: "require('../../../Config')" },
  
  // Models
  { from: /require\(['"]\.\.\/Models['"]\)/g, to: "require('../../../Models')" },
  { from: /require\(['"]\.\.\/Models\//g, to: "require('../../../Models/" },
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    replacements.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

console.log(`🔧 Segunda pasada: corrigiendo rutas específicas...\n`);

let totalFixed = 0;
const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
const modules = entries.filter(e => e.isDirectory());

modules.forEach(moduleDir => {
  const modulePath = path.join(modulesDir, moduleDir.name);
  let moduleFixed = 0;

  // Procesar /commands
  const commandsDir = path.join(modulePath, 'commands');
  if (fs.existsSync(commandsDir)) {
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
    files.forEach(file => {
      if (processFile(path.join(commandsDir, file))) {
        moduleFixed++;
      }
    });
  }

  // Procesar /slashcmds
  const slashDir = path.join(modulePath, 'slashcmds');
  if (fs.existsSync(slashDir)) {
    const files = fs.readdirSync(slashDir).filter(f => f.endsWith('.js'));
    files.forEach(file => {
      if (processFile(path.join(slashDir, file))) {
        moduleFixed++;
      }
    });
  }

  // Procesar /events
  const eventsDir = path.join(modulePath, 'events');
  if (fs.existsSync(eventsDir)) {
    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
    files.forEach(file => {
      if (processFile(path.join(eventsDir, file))) {
        moduleFixed++;
      }
    });
  }

  if (moduleFixed > 0) {
    console.log(`  ✅ ${moduleDir.name}: ${moduleFixed} archivos corregidos`);
    totalFixed += moduleFixed;
  }
});

console.log(`\n✅ Total: ${totalFixed} archivos corregidos`);
