'use strict';

const {
  ButtonStyle,
  ButtonBuilder: DiscordButtonBuilder,
} = require('discord.js');

const { toComponentEmoji } = require('./discordEmoji');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

class ButtonBuilder {
  constructor() {
    this._style = ButtonStyle.Secondary;
    this._customId = undefined;
    this._label = undefined;
    this._disabled = undefined;
    this._emoji = undefined;
    this._url = undefined;
  }

  setStyle(style) {
    this._style = style;
    return this;
  }

  setCustomId(customId) {
    this._customId = String(customId);
    return this;
  }

  setLabel(label) {
    this._label = String(label);
    return this;
  }

  setDisabled(disabled) {
    this._disabled = Boolean(disabled);
    return this;
  }

  setEmoji(emoji) {
    const compEmoji = toComponentEmoji(emoji);

    // Para custom emoji, la validación fuerte ya la hace toComponentEmoji.
    // Para Unicode, Discord acepta nombres de longitud 1 (por ejemplo ℹ, ❌, ➡),
    // así que aquí solo exigimos que haya `id` válido o `name` no vacío.
    if (
      compEmoji &&
      (
        typeof compEmoji.id === 'string' ||
        (typeof compEmoji.name === 'string' && compEmoji.name.length > 0)
      )
    ) {
      this._emoji = compEmoji;
    } else {
      this._emoji = undefined;
    }

    return this;
  }

  setURL(url) {
    this._url = String(url);
    return this;
  }

  toJSON() {
    const style = this._style;
    const styleKey = typeof style === 'string' ? style.trim().toLowerCase() : null;
    const isLink = style === ButtonStyle.Link || styleKey === 'link';

    // Crear un ButtonBuilder genérico (discord.js v14)
    const builder = new DiscordButtonBuilder();

    // Establecer el estilo
    builder.setStyle(this._style);

    if (isLink) {
      if (isNonEmptyString(this._url)) builder.setURL(this._url);
    } else {
      if (isNonEmptyString(this._customId)) {
        builder.setCustomId(this._customId);
        // Validación: si no hay label ni emoji, asigna un label por defecto visible
        if (!isNonEmptyString(this._label) && !this._emoji) {
          builder.setLabel('\u200b'); 
        }
      }
    }

    if (isNonEmptyString(this._label)) builder.setLabel(this._label);
    if (typeof this._disabled === 'boolean') builder.setDisabled(this._disabled);
    if (this._emoji) builder.setEmoji(this._emoji);

    return builder.toJSON();
  }
}

module.exports = {
  ButtonBuilder,
  ButtonStyle,
};
