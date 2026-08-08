#!/usr/bin/env node

/**
 * Script de Migración: Comandos Existentes → Sistema Modular
 * Uso: node Modules/migrate.js [nombre-categoria]
 * 
 * Ejemplo:
 *   node Modules/migrate.js Music
 *   node Modules/migrate.js Economy
 *   node Modules/migrate.js All  (migra todas las categorías)
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'Comandos');
const slashSourceDir = path.join(__dirname, '..', 'Slashcmd');
const modulesDir = __dirname;

const args = process.argv.slice(2);
const category = args[0] || 'All';

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  fs.copyFileSync(src, dest);
  return true;
}

function migrate(categoryName) {
  const categoryPath = path.join(sourceDir, categoryName);
  const slashCategoryPath = path.join(slashSourceDir, categoryName);
  const modulePath = path.join(modulesDir, categoryName);

  console.log(`\n📦 Migrando categoría: ${categoryName}`);
  console.log(`   Fuente: ${categoryPath}`);
  console.log(`   Destino: ${modulePath}`);

  // Crear carpeta de módulo si no existe (formato plano, sin subcarpetas)
  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath, { recursive: true });
  }

  // Crear module.json si no existe
  const moduleJsonPath = path.join(modulePath, 'module.json');
  if (!fs.existsSync(moduleJsonPath)) {
    const meta = {
      name: categoryName,
      version: '1.0.0',
      description: `Módulo ${categoryName}`,
      enabled: true,
      author: 'MoxiLab'
    };
    fs.writeFileSync(moduleJsonPath, JSON.stringify(meta, null, 2));
    console.log(`   ✅ Creado: module.json`);
  }

  // Migrar comandos de prefijo
  let cmdCount = 0;
  if (fs.existsSync(categoryPath)) {
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const src = path.join(categoryPath, file);
      const dest = path.join(modulePath, file);
      if (copyFile(src, dest)) {
        cmdCount++;
      }
    }
    if (cmdCount > 0) {
      console.log(`   ✅ ${cmdCount} comandos de prefijo migrados`);
    }
  }

  // Migrar slash commands
  let slashCount = 0;
  if (fs.existsSync(slashCategoryPath)) {
    const files = fs.readdirSync(slashCategoryPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const src = path.join(slashCategoryPath, file);
      const dest = path.join(modulePath, `slash.${file}`);
      if (copyFile(src, dest)) {
        slashCount++;
      }
    }
    if (slashCount > 0) {
      console.log(`   ✅ ${slashCount} slash commands migrados`);
    }
  }

  if (cmdCount === 0 && slashCount === 0) {
    console.log(`   ⚠️  No se encontraron archivos para migrar`);
  }
}

// Ejecutar migración
if (category === 'All') {
  const categories = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  if (categories.length === 0) {
    console.log('❌ No hay categorías para migrar en Comandos/');
    process.exit(1);
  }

  console.log(`🔄 Migrando ${categories.length} categorías...`);
  categories.forEach(cat => migrate(cat));
  
  console.log('\n✅ Migración completada');
  console.log('⚠️  Recuerda:');
  console.log('   1. Verifica que los archivos se migraron correctamente');
  console.log('   2. Reinicia el bot para que cargue los nuevos módulos');
  console.log('   3. Usa /modules list para verificar que los módulos están cargados');
} else {
  migrate(category);
  console.log('\n✅ Migración completada');
}
