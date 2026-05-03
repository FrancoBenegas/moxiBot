'use strict';
/**
 * Handlers/webApi.js
 * Mini servidor HTTP interno que expone /api/commands al servidor web.
 * No requiere dependencias externas (usa el módulo http nativo de Node).
 *
 * Variables de entorno:
 *   BOT_API_PORT   Puerto a escuchar (default: 3099)
 *   BOT_API_SECRET Clave compartida opcional para autenticar peticiones
 */

const http = require('node:http');
const logger = require('../Util/logger');

const PORT = Number(process.env.BOT_API_PORT ?? 3099);
const SECRET = (process.env.BOT_API_SECRET ?? '').trim();
const PUBLIC_URL = (process.env.BOT_API_PUBLIC_URL ?? '').trim();

// ─── Helpers ────────────────────────────────────────────────────────────────

function isBadDescription(desc) {
  if (!desc || typeof desc !== 'string') return true;
  return /^commands:CMD_/i.test(desc.trim());
}

function safeCategory(cmd) {
  try {
    if (typeof cmd.Category === 'function') {
      const r = cmd.Category('es-ES');
      if (typeof r === 'string' && r.trim()) return r.trim();
    }
    if (typeof cmd.category === 'string' && cmd.category.trim()) return cmd.category.trim();
  } catch { /* ignorar */ }
  return undefined;
}

function safeDescription(cmd) {
  try {
    if (typeof cmd.description === 'function') {
      const r = cmd.description('es-ES');
      if (typeof r === 'string' && r.trim() && !isBadDescription(r)) return r.trim();
      return undefined;
    }
    if (typeof cmd.description === 'string') {
      const d = cmd.description.trim();
      return (!d || isBadDescription(d)) ? undefined : d;
    }
  } catch { /* ignorar */ }
  return undefined;
}

function extractSubcommands(options, baseName) {
  if (!Array.isArray(options)) return [];
  const out = [];
  for (const opt of options) {
    if (!opt || typeof opt !== 'object') continue;
    if (opt.type === 1 && opt.name) {
      out.push({ name: opt.name, description: opt.description || undefined, fullName: `${baseName} ${opt.name}` });
    } else if (opt.type === 2 && opt.name && Array.isArray(opt.options)) {
      for (const sub of opt.options) {
        if (!sub || sub.type !== 1 || !sub.name) continue;
        out.push({ name: sub.name, group: opt.name, description: sub.description || undefined, fullName: `${baseName} ${opt.name} ${sub.name}` });
      }
    }
  }
  return out;
}

// ─── Serialización de comandos ───────────────────────────────────────────────

function serializeCommands(Moxi) {
  const items = [];

  // Prefix commands
  if (Moxi.commands) {
    for (const cmd of Moxi.commands.values()) {
      if (!cmd || !cmd.name) continue;
      const aliasRaw = Array.isArray(cmd.alias) ? cmd.alias : (Array.isArray(cmd.aliases) ? cmd.aliases : []);
      const aliases = aliasRaw.filter((a) => typeof a === 'string' && a !== cmd.name && !cmd.__autoAliasGenerated);
      items.push({
        name: cmd.name,
        description: safeDescription(cmd),
        category: safeCategory(cmd),
        usage: typeof cmd.usage === 'string' && cmd.usage.trim() ? cmd.usage.trim() : undefined,
        aliases: aliases.length ? aliases : undefined,
        cooldown: typeof cmd.cooldown === 'number' ? cmd.cooldown : undefined,
        type: 'prefix',
      });
    }
  }

  // Slash commands
  if (Moxi.slashcommands) {
    for (const cmd of Moxi.slashcommands.values()) {
      const data = cmd?.data || (cmd?.Command && cmd.Command.data);
      if (!data || typeof data.toJSON !== 'function') continue;
      let json;
      try { json = data.toJSON(); } catch { continue; }
      if (!json?.name) continue;

      const subcommands = extractSubcommands(json.options, json.name);
      items.push({
        name: json.name,
        description: json.description && !isBadDescription(json.description) ? json.description : undefined,
        category: safeCategory(cmd),
        subcommands: subcommands.length ? subcommands : undefined,
        cooldown: typeof cmd.cooldown === 'number' ? cmd.cooldown : undefined,
        type: 'slash',
      });
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    count: items.length,
    countPrefix: items.filter((c) => c.type === 'prefix').length,
    countSlash: items.filter((c) => c.type === 'slash').length,
    items,
  };
}

// ─── Servidor HTTP ───────────────────────────────────────────────────────────

function startWebApi(Moxi) {
  const server = http.createServer((req, res) => {
    // Autenticación obligatoria por header X-Bot-Secret cuando está configurado
    if (SECRET) {
      const provided = (req.headers['x-bot-secret'] ?? '').trim();
      if (provided !== SECRET) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/api/commands') {
      try {
        const data = serializeCommands(Moxi);
        const body = JSON.stringify(data);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
      } catch (err) {
        logger.error('[webApi] Error al serializar comandos:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      const body = JSON.stringify({ ok: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/guilds') {
      try {
        const items = [...Moxi.guilds.cache.values()].map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount ?? 0,
        }));
        const body = JSON.stringify({ count: items.length, items });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
      } catch (err) {
        logger.error('[webApi] Error al serializar guilds:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    const localUrl = `http://0.0.0.0:${PORT}`;
    const publicUrl = PUBLIC_URL || `http://<tu-ip-publica>:${PORT}`;
    logger.info && logger.info(`[webApi] API escuchando en ${localUrl} (externa: ${publicUrl})`);
  });

  server.on('error', (err) => {
    logger.error && logger.error('[webApi] Error en el servidor interno:', err);
  });

  return server;
}

module.exports = { startWebApi }; 
