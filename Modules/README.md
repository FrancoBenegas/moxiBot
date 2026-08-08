# Sistema Modular - Documentación

## 📋 Estructura de Carpetas

```
Modules/
├── loader.js                    # ModuleLoader principal
├── Music/                       # Módulo de Música
│   ├── module.json             # Metadata del módulo
│   ├── commands/               # Comandos de prefijo
│   │   ├── play.js
│   │   └── stop.js
│   ├── slashcmds/              # Slash commands
│   │   ├── play.js
│   │   └── stop.js
│   ├── events/                 # Eventos del módulo
│   │   └── playerUpdate.js
│   └── utils.js                # Utilidades internas
├── Admin/
├── Economy/
├── Fun/
└── ... otros módulos
```

## 🆕 Crear un Nuevo Módulo

### 1. Crear la estructura de carpetas

```bash
Modules/MyModule/
├── commands/
├── slashcmds/
├── events/
└── module.json
```

### 2. Crear `module.json`

```json
{
  "name": "MyModule",
  "version": "1.0.0",
  "description": "Descripción del módulo",
  "enabled": true,
  "author": "Tu nombre",
  "dependencies": [],
  "permissions": ["SEND_MESSAGES"],
  "config": {
    "prefix_enabled": true,
    "slash_enabled": true
  }
}
```

### 3. Crear un Comando de Prefijo

**Archivo:** `Modules/MyModule/commands/hello.js`

```javascript
module.exports = {
  name: 'hello',
  alias: ['hi', 'hola'],
  description: 'Saluda al usuario',
  usage: 'hello [@usuario]',
  Category: 'MyModule',
  
  async execute(client, message, args) {
    const user = message.mentions.users.first() || message.author;
    await message.reply(`¡Hola ${user}! 👋`);
  }
};
```

### 4. Crear un Slash Command

**Archivo:** `Modules/MyModule/slashcmds/hello.js`

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Saluda al usuario')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Usuario a saludar')
    ),
  
  async run(client, interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    await interaction.reply(`¡Hola ${user}! 👋`);
  }
};
```

### 5. Crear un Evento

**Archivo:** `Modules/MyModule/events/messageCreate.js`

```javascript
module.exports = (client, moduleLoader) => {
  // El moduleLoader se proporciona para acceso a otros módulos si es necesario
  
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Tu lógica aquí
  });
};
```

## 🎯 Habilitar/Deshabilitar un Módulo

### Opción 1: En `module.json`

```json
{
  "enabled": false
}
```

### Opción 2: Mediante variable de entorno

Puedes añadir en el `.env`:

```env
# Deshabilitar módulos específicos
DISABLED_MODULES=Music,Fun
```

Luego actualizar `loader.js` para leer esta variable.

## 📊 Acceder a Estadísticas de Módulos

```javascript
// En cualquier lugar del código
const stats = client.moduleLoader.getStats();
console.log(stats);
// {
//   modulesCount: 12,
//   totalCommands: 45,
//   totalSlashCommands: 38,
//   totalEvents: 20,
//   errorCount: 0
// }
```

## 🔄 Recargar un Módulo en Tiempo de Ejecución

```javascript
// Recargar el módulo Music
client.moduleLoader.reloadModule('Music');

// Ver todos los módulos cargados
const modules = client.moduleLoader.listModules();
console.log(modules);
```

## 🔗 Acceder a un Módulo desde Otro

```javascript
// Obtener el módulo Music
const musicModule = client.moduleLoader.getModule('Music');

// Acceder a sus comandos
musicModule.commands.forEach(cmd => {
  console.log(cmd.file);
});
```

## 📦 Migrar Comandos Existentes

### Paso 1: Copiar la carpeta

```bash
# Copiar todos los comandos de Music desde Comandos/ a Modules/Music/commands/
cp Comandos/Music/*.js Modules/Music/commands/
```

### Paso 2: Verificar estructura

Asegurate que cada archivo tenga la estructura correcta:
- `name` property
- `execute` function
- Opcionalmente: `alias`, `description`, `usage`, `Category`

### Paso 3: Deshabilitar carpeta antigua

Opcionalmente, renombra o deshabilita:
```bash
mv Comandos/Music Comandos/Music.backup
```

## ⚠️ Validación de Módulos

El loader automáticamente valida:
- ✅ Archivo `module.json` existe
- ✅ Propiedades requeridas en `module.json` (name, version)
- ✅ Archivos `.js` en comandos tienen propiedad `name`
- ✅ Archivos `.js` en slashcmds tienen propiedad `data.name`

Si hay errores, se loguean en `logger.warn()` pero el bot continúa funcionando.

## 🎮 Ejemplo Completo: Módulo Saludo

```
Modules/Greeting/
├── commands/
│   └── hello.js
├── slashcmds/
│   └── hello.js
├── events/
│   └── memberJoin.js
└── module.json
```

**commands/hello.js:**
```javascript
module.exports = {
  name: 'hello',
  description: 'Di hola',
  execute(client, message) {
    message.reply('¡Hola! 👋');
  }
};
```

**slashcmds/hello.js:**
```javascript
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('hello').setDescription('Di hola'),
  run(client, interaction) {
    interaction.reply('¡Hola! 👋');
  }
};
```

**events/memberJoin.js:**
```javascript
module.exports = (client) => {
  client.on('guildMemberAdd', (member) => {
    member.send(`¡Bienvenido a ${member.guild.name}! 👋`);
  });
};
```

**module.json:**
```json
{
  "name": "Greeting",
  "version": "1.0.0",
  "description": "Módulo de saludos",
  "enabled": true
}
```

## 🔧 Solución de Problemas

### El módulo no se carga

1. Verifica que `module.json` existe
2. Verifica que `module.json` tenga `name` y `version`
3. Revisa los logs: busca `[moduleName]` en la salida

### Los comandos no se registran

1. Verifica que los archivos en `commands/` tengan propiedad `name`
2. Verifica que los archivos en `slashcmds/` tengan propiedad `data.name`
3. Reinicia el bot

### El módulo está habilitado pero no veo sus comandos

1. Verifica que `module.json` tenga `"enabled": true`
2. Verifica la consola para ver si hay errores
3. Usa `client.moduleLoader.listModules()` para confirmar que está cargado

---

**Última actualización:** 3 de mayo de 2026
