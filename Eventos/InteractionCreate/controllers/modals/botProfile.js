const { MessageFlags } = require('discord.js');

function getModalTextValue(interaction, customId) {
    try {
        const value = interaction?.fields?.getTextInputValue?.(customId);
        if (typeof value === 'string') return value;
    } catch {
        // ignore
    }

    try {
        const fields = interaction?.fields?.fields;
        if (fields && typeof fields.get === 'function') {
            const item = fields.get(customId);
            if (item && typeof item.value === 'string') return item.value;
        }
    } catch {
        // ignore
    }

    return '';
}

function parseCustomId(customId) {
    const parts = String(customId || '').split(':');
    if (parts.length < 4) return null;
    if (parts[0] !== 'botprofile' || parts[1] !== 'submit') return null;
    return {
        target: parts[2],
        ownerId: parts[3],
    };
}

module.exports = async function botProfileModal(interaction) {
    if (!interaction.isModalSubmit?.()) return false;
    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return false;

    if (!parsed.ownerId || String(parsed.ownerId) !== String(interaction.user?.id || '')) {
        await interaction.reply({
            content: 'Solo quien abrio el panel puede enviar este modal.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    const action = parsed.target;
    const { applyBotProfileChange, normalizeSpaces, normalizeMultiline, buildBotProfilePanel } = require('../../../../Util/botProfilePanel');

    const rawValue = getModalTextValue(interaction, 'value');
    const value = action === 'bio' ? normalizeMultiline(rawValue) : normalizeSpaces(rawValue);
    const type = normalizeSpaces(getModalTextValue(interaction, 'type'));
    const text = normalizeSpaces(getModalTextValue(interaction, 'text'));

    const mappedAction = action === 'name'
        ? 'name'
        : action === 'avatar'
            ? 'avatar'
            : action === 'banner'
                ? 'banner'
                : action === 'bio'
                    ? 'bio'
                    : action === 'nick'
                        ? 'nick'
                        : action === 'activity'
                            ? 'activity'
                            : action === 'status'
                                ? 'status'
                                : null;

    if (!mappedAction) {
        await interaction.reply({ content: 'Accion invalida.', flags: MessageFlags.Ephemeral }).catch(() => null);
        return true;
    }

    try {
        const result = await applyBotProfileChange({
            client: interaction.client,
            guild: interaction.guild,
            action: mappedAction,
            value: mappedAction === 'activity' ? type : value,
            aux: mappedAction === 'activity' ? text : '',
            requesterTag: interaction.user?.tag,
        });

        await interaction.reply({
            content: result.message,
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);

        const panel = await buildBotProfilePanel({
            client: interaction.client,
            guild: interaction.guild,
            ownerId: parsed.ownerId,
        });

        if (interaction.message && typeof interaction.message.edit === 'function') {
            await interaction.message.edit(panel).catch(() => null);
        }
    } catch (e) {
        await interaction.reply({
            content: `Error al aplicar cambios: ${String(e?.message || e)}`,
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
    }

    return true;
};