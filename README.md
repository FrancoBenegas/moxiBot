# Moxi Bot

Bot multiproposito para Discord con enfoque en musica, moderacion, utilidades de comunidad, personalizacion y funciones sociales.

## Estado actual

- Version del proyecto: 1.10.0
- Runtime: Node.js
- Libreria principal: discord.js v14
- Base de datos: MongoDB (Mongoose)
- Idiomas: sistema i18n multi-locale

## Inventario funcional actual

Esta seccion lista lo que ya tiene el bot hoy en produccion/desarrollo activo.

### Musica (Poru + Lavalink)

- Reproduccion, pausa, resume, skip, stop, cola, volumen, autoplay y control de sesion.
- Panel de musica fijo por servidor/canal configurable con imagen de estado.
- Botones de control en Components V2 y flujo de actualizacion automatica del panel.
- Integracion con Spotify (busqueda y manejo de mercados), SoundCloud y fuentes Lavalink.
- Eventos de reproduccion robustos: trackStart, trackEnd, queueEnd, errores de nodo y reconexion.

### Perfil del bot (owner tools)

- Comando botperfil con panel interactivo para gestion centralizada.
- Edicion mediante botones + modales para nombre, bio, nick, estado y actividad.
- Avatar y banner por servidor (guild profile), no solo global.
- Carga de avatar/banner por URL o por attachment (flujo guiado en canal).
- Prefill de valores actuales en modales y vista de estado actual del bot.

### Imagenes y media

- Comando quitarfondo (remove.bg) con soporte URL y attachment.
- Respuestas en Components V2 con vista del resultado en el mismo panel.
- Soporte i18n para textos del comando y manejo de errores por API.

### Moderacion y administracion

- Comandos de sancion (ban, kick, timeout, warn, mute, unban, unmute).
- Reglas automaticas (crear, editar, listar, eliminar) y herramientas de control.
- Auditoria, configuracion de canales/permisos y utilidades de administracion.
- Modulo de mantenimiento global y herramientas root para diagnostico.

### Comunidad y sistemas sociales

- Economia, niveles, ranking y tarjetas de perfil/rango.
- Sistema de cumpleaños y aniversarios con configuracion por servidor.
- Sistema social (compatibilidad/relaciones/marriage y estado social).
- Modulo de feedback y herramientas de participacion de comunidad.

### Streaming y notificaciones

- Sistema de alertas de directos con suscripciones por plataforma.
- Gestion de estado en tiempo real y formatos de mensaje para notificaciones.
- Persistencia de suscripciones y configuracion por servidor.

### Invitaciones y portal

- Invitacion permanente reutilizable por servidor.
- Portal con acceso centralizado.
- Tracking best-effort de invitacion usada.
- Guard anti-invitaciones manuales y controles por variables de entorno.

### IA y clima

- Modo IA por canal (configurable).
- Ejecucion opcional de comandos sin prefijo en canales IA.
- Respuestas de clima en tiempo real (WeatherAPI/Open-Meteo).
- Configuracion contextual del modo IA con controles por canal.

### Internacionalizacion (i18n)

- Soporte multi-idioma con locales en: ar-SA, de-DE, en-US, es-ES, fr-FR, hi-IN, id-ID, it-IT, ja-JP, ko-KR, zh-CN.
- Resolucion de idioma por servidor y estructuras de traduccion por modulo.

### UI y experiencia (Components V2)

- Paneles visuales con ContainerBuilder, MediaGallery, botones y modales.
- Footer estacional y estilos de marca aplicados en vistas clave.
- Flujos interactivos para musica, perfil del bot y comandos utilitarios.

### Persistencia y modelos de datos

- Modelos MongoDB para configuracion de guild, economia, cooldowns, timers, sugerencias, verify, welcome/byes, starboard y mas.
- Esquemas dedicados para streaming, comandos, reglas y configuraciones de perfil.

## Cobertura de modulos por carpetas

El bot esta organizado por dominios funcionales ya activos:

- Comandos prefijo: Comandos/Admin, Economy, Fun, Games, Genshin, Giveaways, Marriage, Moderation, Music, Root, Security, Sistemas, Social, Streaming, Tickets, Tools, Utility, Verification, Voice.
- Comandos slash: Slashcmd con la misma segmentacion por categorias.
- Eventos: Eventos/Client, InteractionCreate, MessageCreate, Music.
- Componentes: Components/Help y Components/V2.
- Utilidades: Util con builders, renderers, helpers y vistas V2.
- Handlers: registro y carga de comandos/eventos/slash/poru.

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

Este README esta enfocado en mostrar todo lo que el bot ya incluye hoy. Para detalle de implementacion tecnica, revisa Comandos, Slashcmd, Eventos, Util, Models y Handlers.
