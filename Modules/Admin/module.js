const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { setGuildModuleEnabled, getGuildSettingsCached } = require('../../Util/guildSettings');
const { PermissionsBitField: { Flags }, ContainerBuilder, MessageFlags } = require('discord.js');

const MODULE_ALIASES = new Map([
    ['bienvenida', 'welcome'], ['welcome', 'welcome'],
    ['roleplay', 'roleplay'], ['rol', 'roleplay'],
    ['economia', 'economy'], ['economy', 'economy'],
    ['utilidades', 'utilities'], ['utilities', 'utilities'], ['herramientas', 'utilities'],
    ['moderacion', 'moderation'], ['moderation', 'moderation'],
    ['musica', 'music'], ['music', 'music'],
    ['ia', 'ai'], ['ai', 'ai'],
    ['sorteos', 'giveaways'], ['giveaways', 'giveaways'],
    ['tickets', 'tickets'],
    ['logs', 'logs'],
    ['automod', 'automod'],
    ['wiki', 'wiki'],
    ['voz', 'voice'], ['voice', 'voice'],
    ['fun', 'fun'], ['diversion', 'fun'],
    ['administracion', 'administration'], ['administration', 'administration'],
    ['sistemas', 'systems'], ['systems', 'systems'],
    ['streaming', 'streaming'],
    ['genshin', 'genshin'],
    ['matrimonio', 'matrimonio'],
]);

function resolveModuleId(raw) {
    const key = String(raw || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return MODULE_ALIASES.get(key) || key || null;
}

function buildPanel({ title, body, ephemeral = false }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body))
        .addSeparatorComponents(s => s.setDivider(true));
    const flags = ephemeral
        ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        : MessageFlags.IsComponentsV2;
    return { content: '', components: [container], flags };
}

async function handleModuleToggle({ guildId, rawModule, rawState, replyFn, listFn, lang }) {
    const sub = (rawModule || '').toLowerCase();

    if (sub === 'list' || sub === 'lista') {
        const settings = await getGuildSettingsCached(guildId).catch(() => null);
        const states = (settings?.ModuleStates && typeof settings.ModuleStates === 'object')
            ? settings.ModuleStates
            : {};
        const lines = Object.entries(states).map(([id, enabled]) =>
            `${enabled === false ? '🔴' : '🟢'} \`${id}\``
        );
        const body = lines.length ? lines.join('\n') : '_Todos los módulos están activos (sin overrides)._';
        return listFn(body);
    }

    const stateStr = (rawState || '').toLowerCase();
    if (!rawModule || !['on', 'off', 'activar', 'desactivar', 'true', 'false', '1', '0'].includes(stateStr)) {
        return replyFn('uso');
    }

    const moduleId = resolveModuleId(rawModule);
    if (!moduleId) return replyFn('not-found', rawModule);

    const enabled = ['on', 'activar', 'true', '1'].includes(stateStr);
    const ok = await setGuildModuleEnabled(guildId, moduleId, enabled).catch(() => false);
    if (!ok) return replyFn('error');

    return replyFn('ok', moduleId, enabled);
}

module.exports = {
    name: 'module',
    alias: ['modulo', 'modulos', 'modules', 'module', 'mod-toggle', 'modtoggle', 'mod'],
    description: function () { return 'Activa o desactiva un módulo del servidor.'; },
    usage: 'module <nombre> <on|off> | module list',
    Category: function (lang) {
        return moxi.translate('commands:CATEGORY_ADMIN', lang || 'es-ES');
    },
    permissions: { User: [Flags.Administrator] },
    cooldown: 5,

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        if (!guildId) return;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES').catch(() => 'es-ES');

        const replyFn = (type, a, b) => {
            if (type === 'uso') return message.reply(buildPanel({ title: '📦 Módulos', body: `**Uso:** \`.module <nombre> <on|off>\`\n**Lista:** \`.module list\`\n\n**Módulos:** welcome, roleplay, economy, utilities, moderation, music, ai, giveaways, tickets, logs, automod, wiki, voice, fun, administration, systems, streaming, genshin, matrimonio` }));
            if (type === 'not-found') return message.reply(buildPanel({ title: '❌ Módulo no encontrado', body: `No reconozco el módulo \`${a}\`.` }));
            if (type === 'error') return message.reply(buildPanel({ title: '❌ Error', body: 'No se pudo guardar el cambio.' }));
            if (type === 'ok') return message.reply(buildPanel({ title: '📦 Módulo actualizado', body: `El módulo \`${a}\` ha sido ${b ? '🟢 **activado**' : '🔴 **desactivado**'}.` }));
        };
        const listFn = (body) => message.reply(buildPanel({ title: '📦 Estado de módulos', body }));

        // Sin argumentos → mostrar lista directamente
        const rawModule = args[0] || 'list';
        return handleModuleToggle({ guildId, rawModule, rawState: args[1], replyFn, listFn, lang });
    },
};

module.exports._handleModuleToggle = handleModuleToggle;
module.exports._buildPanel = buildPanel;
module.exports._resolveModuleId = resolveModuleId;
