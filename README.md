# Moxi Bot

Bot multiproposito para Discord con enfoque en musica, moderacion, utilidades de comunidad, personalizacion y funciones sociales.

## Estado actual

- Version del proyecto: 1.10.0
- Runtime: Node.js
- Libreria principal: discord.js v14
- Base de datos: MongoDB (Mongoose)
- Idiomas: sistema i18n multi-locale

## Funcionalidades principales

### Musica (Poru + Lavalink)

- Reproduccion y control completo de cola.
- Panel de musica fijo por servidor/canal.
- Botones de control (playback, volumen, stop, etc.).
- Auto-actualizacion del panel durante la sesion.
- Integraciones de busqueda con Spotify y soporte de fuentes adicionales.

### Perfil del bot (owner tools)

- Comando botperfil con panel interactivo.
- Edicion por botones + modales.
- Soporte de avatar/banner por servidor.
- Soporte de carga de imagen por attachment (flujo guiado).
- Vista de datos actuales del bot en el panel.

### Imagenes y utilidades

- Comando quitarfondo (remove.bg) con soporte URL y attachment.
- Respuestas con Components V2.
- Vista del resultado en panel visual.

### Moderacion y administracion

- Comandos de sancion (ban, kick, timeout, warn, mute, etc.).
- Reglas automaticas y herramientas de control.
- Auditoria y soporte para configuracion de servidor.

### Comunidad y sistemas sociales

- Niveles, rangos y economia.
- Sistema de cumpleaños/aniversarios.
- Modulo de relaciones/marriage.
- Sistema de alertas de streaming.

### Invitaciones y portal

- Invitacion permanente reutilizable por servidor.
- Portal con acceso centralizado.
- Tracking best-effort de invitacion usada.

### IA y clima

- Modo IA por canal (configurable).
- Ejecucion opcional de comandos sin prefijo en canales IA.
- Respuestas de clima en tiempo real (WeatherAPI/Open-Meteo).

## Arquitectura de comandos

El proyecto organiza comandos y handlers por carpetas:

- Comandos con prefijo en Comandos
- Comandos slash en Slashcmd
- Eventos en Eventos
- Componentes V2 en Components y Util
- Modelos en Models
- Handlers centrales en Handlers

Categorias activas (prefijo y/o slash):

- Admin
- Moderation
- Music
- Tools
- Economy
- Fun
- Games
- Social
- Streaming
- Root
- Security
- Voice
- Verification

## Comandos destacados

- musicpanel: crea/administra panel de musica fijo.
- botperfil: panel para gestionar perfil del bot.
- quitarfondo: elimina fondos de imagen por URL o archivo.
- invite / portal: gestion de invitaciones del servidor.

## Instalacion rapida

1. Instalar dependencias.

```bash
npm install
```

2. Configurar variables de entorno (.env).

Minimas recomendadas:

- TOKEN o DISCORD_TOKEN
- MONGODB
- Lavalink (host, puerto, password)

Opcionales importantes:

- REMOVEBG_API_KEY
- WEATHERAPI_KEY
- PRIVACY_POLICY_URL
- DATA_DELETE_CONTACT

3. Iniciar bot.

```bash
npm run dev
```

o

```bash
npm run start:clean
```

## Versionado y releases

Se usa SemVer: MAJOR.MINOR.PATCH.

- PATCH: fixes y ajustes pequenos.
- MINOR: nuevas funciones compatibles.
- MAJOR: cambios incompatibles.

Scripts disponibles:

- npm run release:patch
- npm run release:minor
- npm run release:major

Historial de releases de la serie 1.x documentado en RELEASE_NOTES.md.

## Seguridad y buenas practicas

- No subas tokens ni API keys al repositorio.
- Rota cualquier credencial expuesta.
- Revisa permisos del bot por servidor antes de habilitar funciones sensibles.

## Documentos relacionados

- PRIVACY.md
- DEBUGGING.md
- RELEASE_NOTES.md
- SPOTIFY_MARKETS.md

## Nota

Este README refleja el estado actual del proyecto y sus sistemas principales. Para ver implementaciones exactas, revisa las carpetas Comandos, Slashcmd, Eventos y Util.
