#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'Modules');

function findIncompleteRequires() {
  const results = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, idx) => {
          // Buscar require('../../ pero no require('../../../
          if (line.includes("require('../../") && !line.includes("require('../../../")) {
            results.push({
              file: fullPath,
              line: idx + 1,
              content: line.trim()
            });
          }
          // Buscar require("../../ pero no require("../../../
          if (line.includes('require("../../') && !line.includes('require("../../../')) {
            results.push({
              file: fullPath,
              line: idx + 1,
              content: line.trim()
            });
          }
        });
      }
    });
  }

  walkDir(modulesDir);
  return results;
}

const results = findIncompleteRequires();

if (results.length === 0) {
  console.log('✅ No hay rutas incompletas');
  process.exit(0);
}

console.log(`❌ Encontradas ${results.length} rutas incompletas:\n`);

results.forEach(result => {
  console.log(`📄 ${result.file.replace(modulesDir, 'Modules')}:${result.line}`);
  console.log(`   ${result.content}\n`);
});

console.log('\nNota: Todas estas necesitan un punto más (../../ → ../../../)');
