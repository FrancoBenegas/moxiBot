# Moxi Bot Release Notes (Serie 1.x)

Este archivo resume los hitos que se etiquetaron como releases historicas.

## Como leer las versiones de Moxi

Formato usado: MAJOR.MINOR.PATCH

- MAJOR: cambios grandes o incompatibles.
  Ejemplo: 1.x.x -> 2.0.0
- MINOR: nuevas funciones sin romper compatibilidad.
  Ejemplo: 1.9.0 -> 1.10.0
- PATCH: correcciones o ajustes pequenos.
  Ejemplo: 1.10.0 -> 1.10.1

## Que significa "version base"

La version base es el punto de partida oficial de la linea actual de releases.

- En este proyecto, la base historica fue 1.0.0.
- Desde ahi se fueron acumulando hitos en la serie 1.x.
- La version actual de referencia es 1.10.0.

## Regla practica para elegir la siguiente version

Usa PATCH (x.y.Z) cuando:

- Corriges bugs.
- Ajustas textos, validaciones o UX sin nuevas funciones grandes.

Usa MINOR (x.Y.0) cuando:

- Agregas comandos o modulos nuevos.
- Mejoras capacidades existentes sin romper comandos actuales.

Usa MAJOR (X.0.0) cuando:

- Cambias comportamiento de forma incompatible.
- Eliminaste o renombraste comandos/configuracion que rompen setups anteriores.

## Flujo recomendado de release

1. Ajustar version en package.json (o usar scripts release:patch/minor/major).
2. Crear commit de release.
3. Crear tag (ejemplo: v1.10.0).
4. Hacer push del branch y de tags.
5. Publicar GitHub Release para cada tag.

## Convencion aplicada en esta serie

- v1.0.0 define el inicio de la serie.
- v1.1.0 a v1.10.0 representan hitos funcionales acumulados.
- Si en el futuro hay una ruptura real de compatibilidad, el siguiente salto seria 2.0.0.

## v1.10.0

Tag: v1.10.0
Commit base: 90e4d33

Resumen:

- Actualizacion de dependencias clave (discord-html-transcripts, musicard).
- Consolidacion de mejoras recientes del panel y sistema del bot.

## v1.9.0

Tag: v1.9.0
Commit base: d050d8d

Resumen:

- Comando de estilo estacional.
- Mejoras visuales y de presentacion de temporada.

## v1.8.0

Tag: v1.8.0
Commit base: 632e8ff

Resumen:

- Soporte de alertas de streaming.
- Gestion de suscripciones y configuracion de flujo.

## v1.7.0

Tag: v1.7.0
Commit base: ff54715

Resumen:

- Integracion de base de datos de Genshin.
- Caching y consulta de personajes.

## v1.6.0

Tag: v1.6.0
Commit base: 88c878f

Resumen:

- Modulo de cumpleanos y aniversarios.
- Comandos y anuncios automaticos relacionados.

## v1.5.0

Tag: v1.5.0
Commit base: e14ea57

Resumen:

- Nuevos comandos de perfil y configuracion de perfil.
- Ajustes sobre gestion de informacion de usuario.

## v1.4.0

Tag: v1.4.0
Commit base: 768de42

Resumen:

- Soporte para prefijos de usuario.
- Botones y modales para establecer/restablecer prefijos.

## v1.3.0

Tag: v1.3.0
Commit base: e9316ce

Resumen:

- Mejoras en gestion de idiomas.
- Soporte de idioma personal y panel de seleccion actualizado.

## v1.2.0

Tag: v1.2.0
Commit base: 8f76f33

Resumen:

- Introduccion de comando de mantenimiento.
- Base para control global de disponibilidad del bot.

## v1.1.0

Tag: v1.1.0
Commit base: dbfe238

Resumen:

- Motor de moderacion completo y almacenamiento.
- Mejoras de seguridad y control de eventos.

## v1.0.0

Tag: v1.0.0
Commit base: fd806f9

Resumen:

- Punto de partida de la serie 1.x.
- Base funcional inicial del proyecto Moxi.

## Nota de uso en GitHub

Para crear cada GitHub Release:

1. Ir a Releases > Draft a new release.
2. Seleccionar el tag (por ejemplo, v1.10.0).
3. Usar el bloque correspondiente de este archivo como descripcion.
4. Publicar.
