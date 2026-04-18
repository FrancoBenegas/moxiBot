const {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { ButtonBuilder, ButtonStyle } = require('../../../../Util/compatButtonBuilder');

function parseCustomId(customId) {
    const parts = String(customId || '').split(':');
    if (parts.length < 4 || parts[0] !== 'botprofile') return null;
    return {
        root: parts[0],
        action: parts[1],
        target: parts[2],
        ownerId: parts[3],
    };
}

function ensureAuthor(parsed, interaction) {
    return parsed?.ownerId && String(parsed.ownerId) === String(interaction.user?.id || '');
}

function buildOneFieldModal({ customId, title, inputId, label, placeholder, required = true, maxLength = 4000, style = TextInputStyle.Short, value = '' }) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
    const input = new TextInputBuilder()
        .setCustomId(inputId)
        .setLabel(label)
        .setStyle(style)
        .setRequired(required)
        .setMaxLength(maxLength);

    if (placeholder) input.setPlaceholder(placeholder);
    if (value) input.setValue(String(value).slice(0, maxLength));

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function buildAssetChoicePayload({ target, ownerId }) {
    const title = target === 'banner' ? 'Elegir metodo para el banner' : 'Elegir metodo para el avatar';
    const text = target === 'banner'
        ? 'Puedes pegar una URL en un modal o subir una imagen directamente en este canal.'
        : 'Puedes pegar una URL en un modal o subir una imagen directamente en este canal.';

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`botprofile:url:${target}:${ownerId}`).setStyle(ButtonStyle.Primary).setLabel('Usar URL'),
        new ButtonBuilder().setCustomId(`botprofile:upload:${target}:${ownerId}`).setStyle(ButtonStyle.Secondary).setLabel(target === 'banner' ? 'Subir Banner' : 'Subir Avatar')
    );

    return {
        title,
        text,
        row,
    };
}

module.exports = async function botProfileButtons(interaction) {
    const parsed = parseCustomId(interaction?.customId);
    if (!parsed) return false;

    if (!ensureAuthor(parsed, interaction)) {
        await interaction.reply({
            content: 'Solo quien abrio el panel puede usar estos botones.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    if (parsed.action === 'refresh') {
        const { buildBotProfilePanel } = require('../../../../Util/botProfilePanel');
        const payload = await buildBotProfilePanel({
            client: interaction.client,
            guild: interaction.guild,
            ownerId: parsed.ownerId,
        });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (parsed.action === 'upload' && (parsed.target === 'avatar' || parsed.target === 'banner')) {
        const { applyBotProfileChange, buildBotProfilePanel } = require('../../../../Util/botProfilePanel');

        if (!interaction.channel || !interaction.channel.isTextBased?.()) {
            await interaction.reply({
                content: '',
                components: [buildNoticeContainer({ title: 'No disponible aqui', text: 'Este flujo requiere un canal de texto.' })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ title: parsed.target === 'banner' ? 'Subir banner' : 'Subir avatar', text: `Sube ahora una imagen en este canal para actualizar tu ${parsed.target} local del servidor. Tienes 90 segundos.` })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);

        const filter = (m) => {
            if (String(m.author?.id || '') !== String(parsed.ownerId)) return false;
            if (!m.attachments || m.attachments.size <= 0) return false;
            const first = m.attachments.first();
            const contentType = String(first?.contentType || first?.content_type || '').toLowerCase();
            return !contentType || contentType.startsWith('image/');
        };

        const collected = await interaction.channel.awaitMessages({
            filter,
            max: 1,
            time: 90_000,
        }).catch(() => null);

        const picked = collected?.first?.() || null;
        const attachment = picked?.attachments?.first?.() || null;
        const imageUrl = String(attachment?.url || '').trim();

        if (!imageUrl) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ title: 'Sin imagen valida', text: 'Tiempo agotado o no se detecto una imagen valida.' })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        const result = await applyBotProfileChange({
            client: interaction.client,
            guild: interaction.guild,
            action: parsed.target,
            value: imageUrl,
            aux: '',
            requesterTag: interaction.user?.tag,
        }).catch((e) => ({ ok: false, message: String(e?.message || e) }));

        await interaction.followUp({
            content: '',
            components: [buildNoticeContainer({ title: result?.ok ? 'Cambio aplicado' : 'No se pudo aplicar', text: result?.message || 'No se pudo aplicar el cambio.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);

        if (result?.ok && interaction.message && typeof interaction.message.edit === 'function') {
            const payload = await buildBotProfilePanel({
                client: interaction.client,
                guild: interaction.guild,
                ownerId: parsed.ownerId,
            });
            await interaction.message.edit(payload).catch(() => null);
        }

        return true;
    }

    if (parsed.action === 'url' && (parsed.target === 'avatar' || parsed.target === 'banner')) {
        const modalId = `botprofile:submit:${parsed.target}:${parsed.ownerId}`;
        const { getBotProfileSnapshot } = require('../../../../Util/botProfilePanel');
        const snap = await getBotProfileSnapshot({ client: interaction.client, guild: interaction.guild }).catch(() => null);

        const modal = buildOneFieldModal({
            customId: modalId,
            title: parsed.target === 'banner' ? 'Cambiar banner del bot' : 'Cambiar avatar del bot',
            inputId: 'value',
            label: parsed.target === 'banner' ? 'URL o off' : 'URL de imagen',
            placeholder: parsed.target === 'banner' ? 'https://.../banner.png | off' : 'https://.../avatar.png',
            maxLength: 2000,
            value: String(parsed.target === 'banner' ? (snap?.bannerUrl || '') : (snap?.avatarUrl || '')),
        });

        await interaction.showModal(modal).catch(() => null);
        return true;
    }

    if (parsed.action !== 'open') return false;

    const modalId = `botprofile:submit:${parsed.target}:${parsed.ownerId}`;
    const { getBotProfileSnapshot } = require('../../../../Util/botProfilePanel');
    const snap = await getBotProfileSnapshot({ client: interaction.client, guild: interaction.guild }).catch(() => null);

    if (parsed.target === 'name') {
        const modal = buildOneFieldModal({
            customId: modalId,
            title: 'Cambiar nombre del bot',
            inputId: 'value',
            label: 'Nuevo nombre',
            placeholder: 'Ej: Moxi Studio',
            maxLength: 32,
            value: String(snap?.username || ''),
        });
        await interaction.showModal(modal).catch(() => null);
        return true;
    }

    if (parsed.target === 'avatar') {
        const payload = buildAssetChoicePayload({ target: 'avatar', ownerId: parsed.ownerId });
        await interaction.reply({
            content: `${payload.title}\n${payload.text}`,
            components: [payload.row],
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    if (parsed.target === 'banner') {
        const payload = buildAssetChoicePayload({ target: 'banner', ownerId: parsed.ownerId });
        await interaction.reply({
            content: `${payload.title}\n${payload.text}`,
            components: [payload.row],
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    if (parsed.target === 'bio') {
        const modal = buildOneFieldModal({
            customId: modalId,
            title: 'Cambiar bio del bot',
            inputId: 'value',
            label: 'Bio o off',
            placeholder: 'Texto de bio o off para quitar',
            maxLength: 190,
            style: TextInputStyle.Paragraph,
            value: String(snap?.guildBio || ''),
        });
        await interaction.showModal(modal).catch(() => null);
        return true;
    }

    if (parsed.target === 'nick') {
        const modal = buildOneFieldModal({
            customId: modalId,
            title: 'Cambiar apodo en este servidor',
            inputId: 'value',
            label: 'Apodo o off',
            placeholder: 'Apodo nuevo o off para quitar',
            maxLength: 32,
            value: String(snap?.guildNickname || ''),
        });
        await interaction.showModal(modal).catch(() => null);
        return true;
    }

    if (parsed.target === 'status') {
        const modal = buildOneFieldModal({
            customId: modalId,
            title: 'Cambiar estado del bot',
            inputId: 'value',
            label: 'Estado',
            placeholder: 'online | idle | dnd | invisible',
            maxLength: 16,
            value: String(snap?.presenceStatus || 'online'),
        });
        await interaction.showModal(modal).catch(() => null);
        return true;
    }

    if (parsed.target === 'activity') {
        const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Cambiar actividad del bot')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('type')
                        .setLabel('Tipo')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('playing | streaming | listening | watching | competing')
                        .setValue(String(snap?.activityTypeInput || 'playing').slice(0, 24))
                        .setRequired(true)
                        .setMaxLength(24)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('text')
                        .setLabel('Texto')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Ej: musica chill 24/7')
                        .setValue(String(snap?.activityName || '').slice(0, 120))
                        .setRequired(true)
                        .setMaxLength(120)
                )
            );

        await interaction.showModal(modal).catch(() => null);
        return true;
    }

    await interaction.reply({
        content: 'Accion no valida.',
        flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return true;
};