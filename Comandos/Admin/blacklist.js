const { ContainerBuilder, MessageFlags, PermissionsBitField } = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const {
    normalizeId,
    addLocalBlacklist,
    removeLocalBlacklist,
    isUserLocallyBlacklisted,
    listLocalBlacklist,
} = require('../../Util/blacklistStorage');

function panel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function parseTargetId(message, raw) {
    const mention = message.mentions?.users?.first?.();
    if (mention?.id) return mention.id;
    return normalizeId(raw);
}

function isUntranslated(key, value) {
    if (value === undefined || value === null) return true;
    const out = String(value || '').trim();
    if (!out) return true;
    if (out === key) return true;
    const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
    if (out === withoutNs) return true;
    if (/^i?[A-Z0-9_]+$/.test(out)) return true;
    return false;
}

module.exports = {
    name: 'blacklist',
    alias: ['bl', 'localblacklist', 'lblacklist'],
    usage: 'blacklist add <@user|id> [motivo] | blacklist remove <@user|id> | blacklist check <@user|id> | blacklist list',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ADMIN', lang),
    description: (lang = 'es-ES') => {
        const key = 'misc:BLACKLIST_LOCAL_DESC';
        const t = moxi.translate(key, lang);
        return (t && t !== key) ? t : 'Gestiona la blacklist local (servidor).';
    },
    cooldown: 5,

    async execute(Moxi, message, args) {
        try {
            if (!message.guild) {
                return message.reply('Este comando solo se puede usar en servidores.');
            }

            const lang = await moxi.guildLang(message.guild.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (key, fallback) => {
                const out = moxi.translate(key, lang);
                return isUntranslated(key, out) ? fallback : out;
            };

            const member = message.member || await message.guild.members.fetch(message.author?.id).catch(() => null);
            const isAdmin = Boolean(member?.permissions?.has?.(PermissionsBitField.Flags.Administrator, true));
            const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: message.author?.id }).catch(() => false);
            if (!isAdmin && !isOwner) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_NO_PERM', 'Necesitas permisos de administrador u owner para usar este comando.')}`,
                }));
            }

            const sub = String(args[0] || 'list').trim().toLowerCase();

            if (sub === 'add' || sub === 'agregar') {
            const targetId = parseTargetId(message, args[1]);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const reason = args.slice(2).join(' ').trim();
            await addLocalBlacklist({
                guildId: message.guild.id,
                userId: targetId,
                reason,
                createdBy: message.author?.id,
            });

            return message.reply(panel({
                title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                body: `${EMOJIS.tick} ${t('misc:BLACKLIST_LOCAL_ADDED', 'Usuario agregado a la blacklist local.')}
Usuario: <@${targetId}>\nID: ${targetId}${reason ? `\n${t('misc:BLACKLIST_REASON', 'Motivo')}: ${reason}` : ''}`,
            }));
        }

            if (sub === 'remove' || sub === 'del' || sub === 'rm' || sub === 'quitar') {
            const targetId = parseTargetId(message, args[1]);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const removed = await removeLocalBlacklist({ guildId: message.guild.id, userId: targetId });

            return message.reply(panel({
                title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                body: removed
                    ? `${EMOJIS.tick} ${t('misc:BLACKLIST_LOCAL_REMOVED', 'Usuario removido de la blacklist local.')}\nUsuario: <@${targetId}>\nID: ${targetId}`
                    : `${EMOJIS.info || 'ℹ️'} ${t('misc:BLACKLIST_NOT_FOUND', 'Ese usuario no estaba en la blacklist.')}\nUsuario: <@${targetId}>\nID: ${targetId}`,
            }));
        }

            if (sub === 'check' || sub === 'estado') {
            const targetId = parseTargetId(message, args[1]);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const isBlocked = await isUserLocallyBlacklisted({ guildId: message.guild.id, userId: targetId });

            return message.reply(panel({
                title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                body: `${isBlocked ? (EMOJIS.cross || '⛔') : (EMOJIS.tick || '✅')} ${isBlocked
                    ? t('misc:BLACKLIST_LOCAL_CHECK_YES', 'El usuario está en blacklist local.')
                    : t('misc:BLACKLIST_LOCAL_CHECK_NO', 'El usuario no está en blacklist local.')}\nUsuario: <@${targetId}>\nID: ${targetId}`,
            }));
        }

            const list = await listLocalBlacklist({ guildId: message.guild.id, limit: 20 });
            if (!list.length) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                    body: `${EMOJIS.info || 'ℹ️'} ${t('misc:BLACKLIST_EMPTY', 'No hay usuarios en la blacklist.')}`,
                }));
            }

            const lines = list.map((entry, index) => {
                const id = String(entry.userId || '').trim();
                const reason = String(entry.reason || '').trim();
                const reasonPart = reason ? ` — ${reason}` : '';
                return `${index + 1}. <@${id}> (${id})${reasonPart}`;
            });

            return message.reply(panel({
                title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                body: lines.join('\n'),
            }));
        } catch (error) {
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (key, fallback) => {
                const out = moxi.translate(key, lang);
                return isUntranslated(key, out) ? fallback : out;
            };
            return message.reply(panel({
                title: t('misc:BLACKLIST_LOCAL_TITLE', 'Blacklist'),
                body: `${EMOJIS.cross} ${t('misc:BLACKLIST_ERROR', 'No pude ejecutar blacklist. Revisa consola para más detalles.')}`,
            }));
        }
    },
};
