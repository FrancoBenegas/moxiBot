const {
    AttachmentBuilder,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
} = require('discord.js');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { withSeasonTitle, formatGlobalFooter } = require('../../Util/seasonBrand');

function getApiKey() {
    const candidates = [
        process.env.REMOVEBG_API_KEY,
        process.env.REMOVE_BG_API_KEY,
        process.env.REMOVEBG_API_KEY,
    ];
    return candidates.find((v) => typeof v === 'string' && v.trim().length > 0) || '';
}

function pickImageInput(message, args) {
    const raw = String(args?.[0] || '').trim();
    if (/^https?:\/\//i.test(raw)) {
        return { mode: 'url', value: raw, attachment: null };
    }

    const attachment = message.attachments?.first?.();
    const contentType = String(attachment?.contentType || attachment?.content_type || '').toLowerCase();
    if (attachment?.url && (!contentType || contentType.startsWith('image/'))) {
        return { mode: 'attachment', value: String(attachment.url), attachment };
    }

    return { mode: 'none', value: '', attachment: null };
}

function parseApiErrorText(rawText, fallbackText) {
    const txt = String(rawText || '').trim();
    if (!txt) return String(fallbackText || 'No se pudo procesar la imagen.');

    try {
        const parsed = JSON.parse(txt);
        const first = parsed?.errors?.[0] || null;
        const title = String(first?.title || '').trim();
        const detail = String(first?.detail || '').trim();
        const code = String(first?.code || '').trim();
        const parts = [title, detail, code ? `(code: ${code})` : ''].filter(Boolean);
        return parts.join(' - ') || txt;
    } catch {
        return txt.slice(0, 300);
    }
}

function buildNoticeContainer({ title, lines, imageUrl }) {
    const safeLines = Array.isArray(lines) ? lines.filter(Boolean).map((v) => String(v)) : [];
    const header = withSeasonTitle(String(title || 'Remove Background'));
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(header));

    if (typeof imageUrl === 'string' && imageUrl.trim()) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(imageUrl.trim())
                )
            );
    }

    if (safeLines.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder());
        safeLines.forEach((line) => {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));
        });
    }

    container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                formatGlobalFooter('Moxi', new Date().getFullYear())
            )
        );

    return container;
}

function asV2Payload({ title, lines, files, imageUrl }) {
    const payload = {
        content: '',
        components: [buildNoticeContainer({ title, lines, imageUrl })],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
    if (Array.isArray(files) && files.length > 0) payload.files = files;
    return payload;
}

module.exports = {
    name: 'quitarfondo',
    alias: ['quitarfondo', 'removebg', 'nobg', 'sinfondo', 'rb'],
    usage: 'quitarfondo <url|adjunto>',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    description: (lang = 'es-ES') => moxi.translate('commands:CMD_QUITARFONDO_DESC', lang) || 'Quita el fondo de una imagen (PNG transparente).',

    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const t = (key, fallback, vars) => {
            const out = moxi.translate(key, lang, vars);
            return (out && out !== key) ? out : fallback;
        };
        const title = t('commands:CMD_QUITARFONDO_TITLE', 'Remove Background');

        if (typeof globalThis.fetch !== 'function' || typeof globalThis.FormData !== 'function') {
            return message.reply(asV2Payload({
                title,
                lines: [t('commands:CMD_QUITARFONDO_UNSUPPORTED', 'Your current runtime does not support fetch/FormData for this command.')],
            }));
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            return message.reply(asV2Payload({
                title,
                lines: [t('commands:CMD_QUITARFONDO_MISSING_KEY', 'Missing REMOVEBG_API_KEY environment variable for this command.')],
            }));
        }

        const imageInput = pickImageInput(message, args);
        if (!imageInput?.value) {
            return message.reply(asV2Payload({
                title,
                lines: [t('commands:CMD_QUITARFONDO_USAGE', 'Usage: quitarfondo <url> or attach an image with the command.')],
            }));
        }

        const waitMsg = await message.reply(asV2Payload({
            title,
            lines: [t('commands:CMD_QUITARFONDO_PROCESSING', 'Processing image, please wait...')],
        })).catch(() => null);

        try {
            const form = new FormData();
            if (imageInput.mode === 'attachment') {
                const fileUrl = String(imageInput.value || '').trim();
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) {
                    throw new Error(`No pude descargar el adjunto (${fileRes.status}).`);
                }

                const fileArr = await fileRes.arrayBuffer();
                const extFromName = String(imageInput.attachment?.name || '').split('.').pop();
                const safeExt = extFromName && /^[a-z0-9]+$/i.test(extFromName) ? extFromName : 'png';
                const fileName = `input_${Date.now()}.${safeExt}`;
                const contentType = String(imageInput.attachment?.contentType || imageInput.attachment?.content_type || 'image/png');
                const blob = new Blob([fileArr], { type: contentType || 'image/png' });
                form.append('image_file', blob, fileName);
            } else {
                form.append('image_url', String(imageInput.value || '').trim());
            }
            form.append('size', 'auto');
            form.append('format', 'png');

            const response = await fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: {
                    'X-Api-Key': apiKey,
                },
                body: form,
            });

            if (!response.ok) {
                const errTxt = await response.text().catch(() => '');
                const friendly = parseApiErrorText(errTxt, t('commands:CMD_QUITARFONDO_DEFAULT_API_ERROR', 'Could not process the image.'));
                if (waitMsg) {
                    return waitMsg.edit(asV2Payload({
                        title,
                        lines: [t('commands:CMD_QUITARFONDO_API_ERROR', 'Could not remove background: {{reason}}', { reason: friendly })],
                    }));
                }
                return message.reply(asV2Payload({
                    title,
                    lines: [t('commands:CMD_QUITARFONDO_API_ERROR', 'Could not remove background: {{reason}}', { reason: friendly })],
                }));
            }

            const arr = await response.arrayBuffer();
            const buffer = Buffer.from(arr);
            const fileName = `moxi_nobg_${Date.now()}.png`;
            const file = new AttachmentBuilder(buffer, { name: fileName });
            const previewUrl = `attachment://${fileName}`;

            if (waitMsg) {
                return waitMsg.edit(asV2Payload({
                    title,
                    lines: [t('commands:CMD_QUITARFONDO_SUCCESS', 'Done, here is your image without background:')],
                    files: [file],
                    imageUrl: previewUrl,
                }));
            }

            return message.reply(asV2Payload({
                title,
                lines: [t('commands:CMD_QUITARFONDO_SUCCESS', 'Done, here is your image without background:')],
                files: [file],
                imageUrl: previewUrl,
            }));
        } catch (error) {
            const msg = String(error?.message || error || 'error desconocido').slice(0, 300);
            if (waitMsg) {
                return waitMsg.edit(asV2Payload({
                    title,
                    lines: [t('commands:CMD_QUITARFONDO_RUNTIME_ERROR', 'Error removing background: {{reason}}', { reason: msg })],
                }));
            }
            return message.reply(asV2Payload({
                title,
                lines: [t('commands:CMD_QUITARFONDO_RUNTIME_ERROR', 'Error removing background: {{reason}}', { reason: msg })],
            }));
        }
    },
};
