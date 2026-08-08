#!/usr/bin/env node

/**
 * Script para limpiar encoding de module.json
 * Remueve caracteres BOM que causan errores de parsing
 */

const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'Modules');

function cleanBOM(text) {
  // Remover BOM UTF-8 si existe
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.substring(1);
  }
  return text;
}

const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
const modules = entries.filter(e => e.isDirectory()).map(e => e.name);

console.log(`🧹 Limpiando ${modules.length} module.json...\n`);

modules.forEach(moduleName => {
  const jsonPath = path.join(modulesDir, moduleName, 'module.json');
  
  if (fs.existsSync(jsonPath)) {
    try {
      // Leer archivo
      const content = fs.readFileSync(jsonPath, 'utf8');
      
      // Limpiar BOM
      const cleaned = cleanBOM(content);
      
      // Validar JSON
      JSON.parse(cleaned);
      
      // Escribir sin BOM
      fs.writeFileSync(jsonPath, cleaned, { encoding: 'utf8' });
      console.log(`✅ ${moduleName}/module.json`);
    } catch (e) {
      console.log(`❌ ${moduleName}: ${e.message}`);
    }
  }
});

console.log('\n✅ Limpieza completada');
