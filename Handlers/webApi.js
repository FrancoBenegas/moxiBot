'use strict';
/**
 * Handlers/webApi.js
 * Mini servidor HTTP interno que expone /api/commands y /api/modules al servidor web.
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

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModuleId(value) {
  const key = normalizeText(value);
  if (!key) return '';

  const aliases = new Map([
    ['welcome', 'welcome'],
    ['bienvenida', 'welcome'],
    ['sistema de bienvenida', 'welcome'],
    ['roleplay', 'roleplay'],
    ['rol', 'roleplay'],
    ['economia', 'economy'],
    ['economy', 'economy'],
    ['utilidades', 'utilities'],
    ['utilidad', 'utilities'],
    ['herramientas', 'utilities'],
    ['utilities', 'utilities'],
    ['moderacion', 'moderation'],
    ['moderation', 'moderation'],
    ['musica', 'music'],
    ['music', 'music'],
    ['ia', 'ai'],
    ['inteligencia artificial', 'ai'],
    ['ai', 'ai'],
    ['sorteos', 'giveaways'],
    ['giveaways', 'giveaways'],
    ['tickets', 'tickets'],
    ['soporte', 'tickets'],
    ['logs', 'logs'],
    ['registros', 'logs'],
    ['automod', 'automod'],
    ['automoderacion', 'automod'],
    ['wiki', 'wiki'],
    ['voice', 'voice'],
    ['voz', 'voice'],
    ['owner', 'owner'],
    ['propietario', 'owner'],
    ['fun', 'fun'],
    ['diversion', 'fun'],
    ['juegos', 'fun'],
    ['administracion', 'administration'],
    ['administration', 'administration'],
    ['sistema', 'systems'],
    ['sistemas', 'systems'],
    ['systems', 'systems'],
    ['streaming', 'streaming'],
    ['genshin', 'genshin'],
    ['matrimonio', 'matrimonio'],
  ]);

  return aliases.get(key) ?? key.replace(/\s+/g, '-');
}

const MODULE_META = {
  welcome: { icon: 'MessageSquare', configColor: 'from-blue-500 to-cyan-500', dashboardColor: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' },
  roleplay: { icon: 'Swords', configColor: 'from-rose-500 to-pink-500', dashboardColor: 'from-rose-500/20 to-pink-500/20 border-rose-500/30' },
  economy: { icon: 'Coins', configColor: 'from-yellow-500 to-amber-500', dashboardColor: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30' },
  utilities: { icon: 'Wrench', configColor: 'from-slate-500 to-gray-500', dashboardColor: 'from-slate-500/20 to-gray-500/20 border-slate-500/30' },
  moderation: { icon: 'Shield', configColor: 'from-red-500 to-orange-500', dashboardColor: 'from-red-500/20 to-orange-500/20 border-red-500/30' },
  ai: { icon: 'Sparkles', configColor: 'from-violet-500 to-purple-500', dashboardColor: 'from-violet-500/20 to-purple-500/20 border-violet-500/30' },
  music: { icon: 'Music', configColor: 'from-green-500 to-emerald-500', dashboardColor: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  giveaways: { icon: 'Gift', configColor: 'from-fuchsia-500 to-pink-500', dashboardColor: 'from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30' },
  tickets: { icon: 'Ticket', configColor: 'from-indigo-500 to-blue-500', dashboardColor: 'from-indigo-500/20 to-blue-500/20 border-indigo-500/30' },
  logs: { icon: 'Bell', configColor: 'from-teal-500 to-cyan-500', dashboardColor: 'from-teal-500/20 to-cyan-500/20 border-teal-500/30' },
  automod: { icon: 'Bot', configColor: 'from-orange-500 to-red-500', dashboardColor: 'from-orange-500/20 to-red-500/20 border-orange-500/30' },
  wiki: { icon: 'BookOpen', configColor: 'from-lime-500 to-green-500', dashboardColor: 'from-lime-500/20 to-green-500/20 border-lime-500/30' },
  voice: { icon: 'Mic', configColor: 'from-cyan-500 to-sky-500', dashboardColor: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/30' },
  owner: { icon: 'Crown', configColor: 'from-amber-500 to-yellow-500', dashboardColor: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30' },
  fun: { icon: 'Gamepad2', configColor: 'from-pink-500 to-rose-500', dashboardColor: 'from-pink-500/20 to-rose-500/20 border-pink-500/30' },
  administration: { icon: 'Settings2', configColor: 'from-slate-500 to-zinc-500', dashboardColor: 'from-slate-500/20 to-zinc-500/20 border-slate-500/30' },
  systems: { icon: 'Cpu', configColor: 'from-blue-500 to-indigo-500', dashboardColor: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30' },
  streaming: { icon: 'Radio', configColor: 'from-red-500 to-pink-500', dashboardColor: 'from-red-500/20 to-pink-500/20 border-red-500/30' },
  genshin: { icon: 'Sparkles', configColor: 'from-purple-500 to-fuchsia-500', dashboardColor: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30' },
  matrimonio: { icon: 'HeartHandshake', configColor: 'from-rose-500 to-red-500', dashboardColor: 'from-rose-500/20 to-red-500/20 border-rose-500/30' },
};

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

function serializeModules(Moxi) {
  // Derivamos módulos desde categorías de comandos para que sea automático.
  const commands = serializeCommands(Moxi);
  const seen = new Set();
  const items = [];

  for (const cmd of commands.items) {
    const rawName = String(cmd.category ?? '').trim();
    if (!rawName) continue;
    const id = normalizeModuleId(rawName);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const meta = MODULE_META[id] ?? {
      icon: 'Box',
      configColor: 'from-slate-500 to-slate-600',
      dashboardColor: 'from-slate-500/20 to-slate-600/20 border-slate-500/30',
    };
    items.push({
      id,
      name: rawName,
      description: `Modulo ${rawName}`,
      icon: meta.icon,
      configColor: meta.configColor,
      dashboardColor: meta.dashboardColor,
    });
  }

  items.sort((a, b) => a.id.localeCompare(b.id));

  return {
    generatedAt: new Date().toISOString(),
    count: items.length,
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

    if (req.method === 'GET' && url.pathname === '/api/modules') {
      try {
        const data = serializeModules(Moxi);
        const body = JSON.stringify(data);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
      } catch (err) {
        logger.error('[webApi] Error al serializar módulos:', err);
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
          icon: g.icon ?? null,
          iconUrl: g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
            : null,
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
