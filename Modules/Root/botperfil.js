const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { buildBotProfilePanel, applyBotProfileChange, normalizeSpaces } = require('../../Util/botProfilePanel');

function parseImageInput(message, raw) {
    const direct = normalizeSpaces(raw);
    if (/^https?:\/\//i.test(direct)) return direct;

    const attachment = message.attachments?.first?.();
    const contentType = String(attachment?.contentType || attachment?.content_type || '').toLowerCase();
    if (attachment?.url && (!contentType || contentType.startsWith('image/'))) {
        return String(attachment.url);
    }
    return '';
}

async function ensureOwner(Moxi, message, lang) {
    const requesterId = message.author?.id;
    if (await isDiscordOnlyOwner({ client: Moxi, userId: requesterId })) return true;

    await message.reply(
        asV2MessageOptions(
            buildNoticeContainer({
                title: 'Bot Profile',
                emoji: EMOJIS.cross,
                text: moxi.translate('NO_PERMISSION', lang) || 'No tienes permisos para usar este comando.',
            })
        )
    );
    return false;
}

module.exports = {
    name: 'botperfil',
    alias: ['botperfil', 'botprofile', 'setbot', 'perfilbot'],
    usage: 'botperfil [panel|status|nombre|avatar|banner|bio|apodo|actividad|estado] ...',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ROOT', lang);
    },
    description: function (lang) {
        lang = lang || 'es-ES';
        const key = 'commands:CMD_BOTPERFIL_DESC';
        const out = moxi.translate(key, lang);
        return (out && out !== key) ? out : 'Configura perfil del bot (owner only).';
    },

    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        if (!await ensureOwner(Moxi, message, lang)) return;

        const sub = normalizeSpaces(args?.[0] || 'panel').toLowerCase();
        const rest = Array.isArray(args) ? args.slice(1) : [];

        if (!sub || ['panel', 'status', 'ver', 'info'].includes(sub)) {
            const panel = await buildBotProfilePanel({
                client: Moxi,
                guild: message.guild,
                ownerId: message.author?.id,
            });
            return message.reply(panel);
        }

        // Compatibilidad legacy por texto
        let action = null;
        let value = '';
        let aux = '';

        if (sub === 'nombre' || sub === 'username') {
            action = 'name';
            value = normalizeSpaces(rest.join(' '));
        } else if (sub === 'avatar' || sub === 'foto') {
            action = 'avatar';
            value = parseImageInput(message, rest[0]);
        } else if (sub === 'banner') {
            action = 'banner';
            value = parseImageInput(message, rest[0]) || normalizeSpaces(rest[0]);
        } else if (sub === 'bio' || sub === 'about' || sub === 'descripcion') {
            action = 'bio';
            value = normalizeSpaces(rest.join(' '));
        } else if (sub === 'apodo' || sub === 'nick' || sub === 'nickname') {
            action = 'nick';
            value = normalizeSpaces(rest.join(' '));
        } else if (sub === 'actividad') {
            action = 'activity';
            value = normalizeSpaces(rest[0]);
            aux = normalizeSpaces(rest.slice(1).join(' '));
        } else if (sub === 'estado') {
            action = 'status';
            value = normalizeSpaces(rest[0]);
        }

        if (!action) {
            const panel = await buildBotProfilePanel({
                client: Moxi,
                guild: message.guild,
                ownerId: message.author?.id,
            });
            return message.reply(panel);
        }

        try {
            const result = await applyBotProfileChange({
                client: Moxi,
                guild: message.guild,
                action,
                value,
                aux,
                requesterTag: message.author?.tag,
            });

            const notice = buildNoticeContainer({
                title: 'Bot Profile',
                emoji: result.ok ? EMOJIS.tick : EMOJIS.cross,
                text: result.message,
            });

            await message.reply(asV2MessageOptions(notice));

            const panel = await buildBotProfilePanel({
                client: Moxi,
                guild: message.guild,
                ownerId: message.author?.id,
            });
            return message.channel.send(panel);
        } catch (e) {
            return message.reply(asV2MessageOptions(buildNoticeContainer({
                title: 'Bot Profile',
                emoji: EMOJIS.cross,
                text: `Error al actualizar perfil del bot: ${String(e?.message || e)}`,
            })));
        }
    },
};
