const { ContainerBuilder, MessageFlags } = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const {
    normalizeId,
    addGlobalBlacklist,
    removeGlobalBlacklist,
    isUserGloballyBlacklisted,
    listGlobalBlacklist,
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
    name: 'gblacklist',
    alias: ['globalblacklist', 'gbl', 'blacklistglobal'],
    usage: 'gblacklist add <@user|id> [motivo] | gblacklist remove <@user|id> | gblacklist check <@user|id> | gblacklist list',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ROOT', lang),
    description: (lang = 'es-ES') => {
        const key = 'misc:BLACKLIST_GLOBAL_DESC';
        const t = moxi.translate(key, lang);
        return (t && t !== key) ? t : 'Gestiona la blacklist global (owner).';
    },
    cooldown: 5,

    async execute(Moxi, message, args) {
        try {
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (key, fallback) => {
                const out = moxi.translate(key, lang);
                return isUntranslated(key, out) ? fallback : out;
            };

            const requesterId = message.author?.id;
            const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: requesterId });
            if (!isOwner) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_GLOBAL_OWNER_ONLY', 'Solo los owners del bot pueden usar este comando.')}`,
                }));
            }

            const sub = String(args[0] || 'list').trim().toLowerCase();

            if (sub === 'add' || sub === 'agregar') {
            const targetId = parseTargetId(message, args[1]);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const reason = args.slice(2).join(' ').trim();
            await addGlobalBlacklist({
                userId: targetId,
                reason,
                createdBy: requesterId,
            });

            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: `${EMOJIS.tick} ${t('misc:BLACKLIST_GLOBAL_ADDED', 'Usuario agregado a la blacklist global.')}\nUsuario: <@${targetId}>\nID: ${targetId}${reason ? `\n${t('misc:BLACKLIST_REASON', 'Motivo')}: ${reason}` : ''}`,
            }));
        }

            if (sub === 'remove' || sub === 'del' || sub === 'rm' || sub === 'quitar') {
            const targetId = parseTargetId(message, args[1]);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const removed = await removeGlobalBlacklist({ userId: targetId });

            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: removed
                    ? `${EMOJIS.tick} ${t('misc:BLACKLIST_GLOBAL_REMOVED', 'Usuario removido de la blacklist global.')}\nUsuario: <@${targetId}>\nID: ${targetId}`
                    : `${EMOJIS.info || 'ℹ️'} ${t('misc:BLACKLIST_NOT_FOUND', 'Ese usuario no estaba en la blacklist.')}\nUsuario: <@${targetId}>\nID: ${targetId}`,
            }));
        }

            if (sub === 'check' || sub === 'estado') {
            const targetId = parseTargetId(message, args[1]);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const isBlocked = await isUserGloballyBlacklisted({ userId: targetId });

            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: `${isBlocked ? (EMOJIS.cross || '⛔') : (EMOJIS.tick || '✅')} ${isBlocked
                    ? t('misc:BLACKLIST_GLOBAL_CHECK_YES', 'El usuario está en blacklist global.')
                    : t('misc:BLACKLIST_GLOBAL_CHECK_NO', 'El usuario no está en blacklist global.')}\nUsuario: <@${targetId}>\nID: ${targetId}`,
            }));
        }

            const list = await listGlobalBlacklist({ limit: 30 });
            if (!list.length) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
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
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: lines.join('\n'),
            }));
        } catch (error) {
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (key, fallback) => {
                const out = moxi.translate(key, lang);
                return isUntranslated(key, out) ? fallback : out;
            };
            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: `${EMOJIS.cross} ${t('misc:BLACKLIST_ERROR', 'No pude ejecutar blacklist. Revisa consola para más detalles.')}`,
            }));
        }
    },
};
