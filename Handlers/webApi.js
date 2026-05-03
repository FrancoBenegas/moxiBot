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
const fs = require('node:fs');
const path = require('node:path');
const logger = require('../Util/logger');
const moxi = require('../i18n');
const { getGuildSettingsCached, setGuildModuleEnabled } = require('../Util/guildSettings');
const { buildDisabledMusicSessionContainer, buildActiveMusicSessionContainer } = require('../Components/V2/musicControlsComponent');
const { formatSessionEndedFooter } = require('../Util/seasonBrand');
const { buildActiveMusicPanelData } = require('../Util/musicPanelAutoUpdater');

const PORT = Number(process.env.BOT_API_PORT ?? 3099);
const SECRET = (process.env.BOT_API_SECRET ?? '').trim();
const PUBLIC_URL = (process.env.BOT_API_PUBLIC_URL ?? '').trim();

function resolvePanelImageUrl(Moxi) {
  const envUrl = String(process.env.MUSIC_FALLBACK_IMAGE_URL || '').trim();
  if (envUrl) return envUrl;
  return Moxi?.user?.displayAvatarURL?.({ extension: 'png', size: 1024 }) || null;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

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
    ['economy', 'economy'],
    ['economia', 'economy'],
    ['fun', 'fun'],
    ['diversion', 'fun'],
    ['games', 'games'],
    ['juegos', 'games'],
    ['genshin', 'genshin'],
    ['giveaways', 'giveaways'],
    ['sorteos', 'giveaways'],
    ['matrimonio', 'marriage'],
    ['marriage', 'marriage'],
    ['moderation', 'moderation'],
    ['moderacion', 'moderation'],
    ['music', 'music'],
    ['musica', 'music'],
    ['security', 'security'],
    ['seguridad', 'security'],
    ['sistemas', 'sistemas'],
    ['social', 'social'],
    ['streaming', 'streaming'],
    ['systems', 'systems'],
    ['sistema', 'systems'],
    ['tickets', 'tickets'],
    ['soporte', 'tickets'],
    ['tools', 'tools'],
    ['herramientas', 'tools'],
    ['utiility', 'utiility'],
    ['utility', 'utiility'],
    ['utilidad', 'utiility'],
    ['verification', 'verification'],
    ['verificacion', 'verification'],
    ['voice', 'voice'],
    ['voz', 'voice'],
  ]);

  return aliases.get(key) ?? key.replace(/\s+/g, '-');
}

const MODULE_META = {
  economy:      { icon: 'Coins',          configColor: 'from-yellow-500 to-amber-500',   dashboardColor: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30' },
  fun:          { icon: 'Gamepad2',       configColor: 'from-pink-500 to-rose-500',      dashboardColor: 'from-pink-500/20 to-rose-500/20 border-pink-500/30' },
  games:        { icon: 'Gamepad2',       configColor: 'from-emerald-500 to-teal-500',   dashboardColor: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30' },
  genshin:      { icon: 'Sparkles',       configColor: 'from-purple-500 to-fuchsia-500', dashboardColor: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30' },
  giveaways:    { icon: 'Gift',           configColor: 'from-fuchsia-500 to-pink-500',   dashboardColor: 'from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30' },
  marriage:   { icon: 'HeartHandshake', configColor: 'from-rose-500 to-red-500',       dashboardColor: 'from-rose-500/20 to-red-500/20 border-rose-500/30' },
  moderation:   { icon: 'Shield',         configColor: 'from-red-500 to-orange-500',     dashboardColor: 'from-red-500/20 to-orange-500/20 border-red-500/30' },
  music:        { icon: 'Music',          configColor: 'from-green-500 to-emerald-500',  dashboardColor: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  security:     { icon: 'ShieldCheck',    configColor: 'from-red-600 to-rose-500',       dashboardColor: 'from-red-600/20 to-rose-500/20 border-red-600/30' },
  sistemas:     { icon: 'Settings',       configColor: 'from-zinc-500 to-slate-500',     dashboardColor: 'from-zinc-500/20 to-slate-500/20 border-zinc-500/30' },
  social:       { icon: 'Users',          configColor: 'from-sky-500 to-blue-500',       dashboardColor: 'from-sky-500/20 to-blue-500/20 border-sky-500/30' },
  streaming:    { icon: 'Radio',          configColor: 'from-red-500 to-pink-500',       dashboardColor: 'from-red-500/20 to-pink-500/20 border-red-500/30' },
  systems:      { icon: 'Cpu',            configColor: 'from-blue-500 to-indigo-500',    dashboardColor: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30' },
  tickets:      { icon: 'Ticket',         configColor: 'from-indigo-500 to-blue-500',    dashboardColor: 'from-indigo-500/20 to-blue-500/20 border-indigo-500/30' },
  tools:        { icon: 'Wrench',         configColor: 'from-stone-500 to-neutral-500',  dashboardColor: 'from-stone-500/20 to-neutral-500/20 border-stone-500/30' },
  utiility:     { icon: 'LayoutDashboard',configColor: 'from-indigo-500 to-violet-500',  dashboardColor: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30' },
  verification: { icon: 'BadgeCheck',     configColor: 'from-green-500 to-lime-500',     dashboardColor: 'from-green-500/20 to-lime-500/20 border-green-500/30' },
  voice:        { icon: 'Mic',            configColor: 'from-cyan-500 to-sky-500',       dashboardColor: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/30' },
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

// Carpetas a ignorar (no son módulos de usuario)
const MODULES_SKIP = new Set(['Admin', 'Root']);
const MODULES_DIR = path.join(__dirname, '..', 'Modules');

function serializeModules(_Moxi, lang) {
  const resolvedLang = String(lang || 'es-ES').trim();
  const fallback = {
    icon: 'Box',
    configColor: 'from-slate-500 to-slate-600',
    dashboardColor: 'from-slate-500/20 to-slate-600/20 border-slate-500/30',
  };

  let folders = [];
  try {
    folders = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !MODULES_SKIP.has(d.name))
      .map(d => d.name)
      .sort();
  } catch (e) {
    logger.error('[webApi] No se pudo leer Modules/:', e.message);
  }

  const items = folders.map((folder) => {
    const id = folder.toLowerCase();
    const meta = MODULE_META[id] ?? fallback;

    // Leer module.json si existe para obtener nombre/descripción real
    let name = folder;
    let description = `Módulo ${folder}`;
    try {
      const jsonPath = path.join(MODULES_DIR, folder, 'module.json');
      if (fs.existsSync(jsonPath)) {
        const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        // Soporte multiidioma: names/descriptions son objetos { 'es-ES': '...', 'en-US': '...' }
        if (json.names && typeof json.names === 'object') {
          name = json.names[resolvedLang] || json.names['en-US'] || json.name || folder;
        } else if (json.name) {
          name = json.name;
        }
        if (json.descriptions && typeof json.descriptions === 'object') {
          description = json.descriptions[resolvedLang] || json.descriptions['en-US'] || json.description || description;
        } else if (json.description) {
          description = json.description;
        }
      }
    } catch { /* si no hay module.json, usamos defaults */ }

    return { id, name, description, icon: meta.icon, configColor: meta.configColor, dashboardColor: meta.dashboardColor };
  });

  return { generatedAt: new Date().toISOString(), count: items.length, items };
}

function serializeComponentTree(component) {
  if (!component || typeof component.toJSON !== 'function') return null;
  try {
    return component.toJSON();
  } catch {
    return null;
  }
}

async function serializeMusicPanelPreview(Moxi, guildId) {
  const cleanGuildId = String(guildId ?? '').trim();
  if (!cleanGuildId) {
    return { ok: false, reason: 'missing_guild_id' };
  }

  const guild = Moxi.guilds?.cache?.get(cleanGuildId)
    || await Moxi.guilds?.fetch?.(cleanGuildId).catch(() => null);

  if (!guild) {
    return { ok: false, reason: 'guild_not_found', guildId: cleanGuildId };
  }

  const settings = await getGuildSettingsCached(cleanGuildId).catch(() => null);
  const channelId = String(settings?.MusicFixedPanelChannelId || '').trim() || null;
  const messageId = String(settings?.MusicFixedPanelMessageId || '').trim() || null;
  const imageUrl = String(settings?.MusicFixedPanelImageUrl || '').trim() || resolvePanelImageUrl(Moxi) || null;
  const player = Moxi.poru?.players?.get(cleanGuildId) || null;
  const lang = await moxi.guildLang(cleanGuildId, process.env.DEFAULT_LANG || 'es-ES').catch(() => process.env.DEFAULT_LANG || 'es-ES');

  let title = '## Panel de musica fijo';
  let info = 'Escribe aqui el nombre de una cancion para reproducirla automaticamente.\nLos comandos de musica tambien funcionan normalmente.';
  let footerText = formatSessionEndedFooter();
  let state = 'idle';
  let activeFilter = null;

  if (player?.currentTrack?.info) {
    const activeData = await buildActiveMusicPanelData({
      player,
      lang,
      imageUrl,
    }).catch(() => null);

    if (activeData) {
      title = activeData.title;
      info = activeData.info;
      footerText = activeData.footerText;
      state = 'active';
      try {
        activeFilter = player.get('__moxiActiveFilter') || null;
      } catch {
        activeFilter = null;
      }
    }
  }

  const container = state === 'active'
    ? buildActiveMusicSessionContainer({ title, info, imageUrl, footerText, activeFilter })
    : buildDisabledMusicSessionContainer({ title, info, imageUrl, footerText });

  return {
    ok: true,
    guildId: cleanGuildId,
    guildName: guild.name,
    state,
    configured: Boolean(channelId && messageId),
    panel: {
      title,
      info,
      imageUrl,
      footerText,
      channelId,
      messageId,
      activeFilter,
      componentTree: serializeComponentTree(container),
    },
  };
}

async function serializeGuildModuleStates(guildId) {
  const cleanGuildId = String(guildId ?? '').trim();
  if (!cleanGuildId) return { ok: false, reason: 'missing_guild_id' };

  const settings = await getGuildSettingsCached(cleanGuildId).catch(() => null);
  const rawStates = (settings && typeof settings.ModuleStates === 'object' && settings.ModuleStates)
    ? settings.ModuleStates
    : {};

  const moduleStates = Object.fromEntries(
    Object.entries(rawStates)
      .map(([key, value]) => [normalizeModuleId(key), value === false ? false : true])
      .filter(([key]) => Boolean(key))
  );

  return {
    ok: true,
    guildId: cleanGuildId,
    moduleStates,
  };
}

// ─── Servidor HTTP ───────────────────────────────────────────────────────────

function startWebApi(Moxi) {
  const server = http.createServer(async (req, res) => {
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
        const lang = url.searchParams.get('lang') || 'es-ES';
        const data = serializeModules(Moxi, lang);
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

    if (req.method === 'GET' && url.pathname === '/api/music-panel') {
      try {
        const guildId = url.searchParams.get('guildId');
        const data = await serializeMusicPanelPreview(Moxi, guildId);
        const status = data.ok ? 200 : (data.reason === 'guild_not_found' ? 404 : 400);
        const body = JSON.stringify(data);
        res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
      } catch (err) {
        logger.error('[webApi] Error al serializar music panel:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
      return;
    }

    const guildModulesMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/module-states$/);
    if (guildModulesMatch && req.method === 'GET') {
      try {
        const data = await serializeGuildModuleStates(guildModulesMatch[1]);
        const body = JSON.stringify(data);
        res.writeHead(data.ok ? 200 : 400, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
      } catch (err) {
        logger.error('[webApi] Error al serializar estados de módulos:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
      return;
    }

    const guildModuleToggleMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/module-states\/([^/]+)$/);
    if (guildModuleToggleMatch && req.method === 'PUT') {
      try {
        const guildId = guildModuleToggleMatch[1];
        const moduleId = normalizeModuleId(guildModuleToggleMatch[2]);
        const payload = await readJsonBody(req);
        if (!moduleId || typeof payload?.enabled !== 'boolean') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'guildId, moduleId y enabled son obligatorios.' }));
          return;
        }

        const ok = await setGuildModuleEnabled(guildId, moduleId, payload.enabled);
        const estado = payload.enabled ? 'ACTIVADO' : 'DESACTIVADO';
        const guildName = Moxi?.guilds?.cache?.get(guildId)?.name ?? guildId;
        logger.info(`[MODULE TOGGLE] Módulo "${moduleId}" ${estado} en "${guildName}" → ${ok ? 'guardado' : 'error al guardar'}`);
        const body = JSON.stringify({ ok, guildId, moduleId, enabled: payload.enabled });
        res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
        res.end(body);
      } catch (err) {
        logger.error('[webApi] Error al actualizar estado de módulo:', err);
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
