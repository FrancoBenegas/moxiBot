const { SlashCommandBuilder: DiscordSlashCommandBuilder } = require('discord.js');

class SlashCommandBuilder extends DiscordSlashCommandBuilder {
  setDMPermission(enabled) {
    // En discord.js v14, setDMPermission sigue existiendo
    // Solo lo heredamos del padre
    if (typeof super.setDMPermission === 'function') {
      return super.setDMPermission(enabled);
    }

    return this;
  }

  // Métodos plurales (mapeo a singulares de discord.js v14)
  addStringOptions(fn) {
    return this.addStringOption(fn);
  }

  addIntegerOptions(fn) {
    return this.addIntegerOption(fn);
  }

  addNumberOptions(fn) {
    return this.addNumberOption(fn);
  }

  addBooleanOptions(fn) {
    return this.addBooleanOption(fn);
  }

  addUserOptions(fn) {
    return this.addUserOption(fn);
  }

  addChannelOptions(fn) {
    return this.addChannelOption(fn);
  }

  addRoleOptions(fn) {
    return this.addRoleOption(fn);
  }

  addMentionableOptions(fn) {
    return this.addMentionableOption(fn);
  }

  addAttachmentOptions(fn) {
    return this.addAttachmentOption(fn);
  }

  addSubcommands(fn) {
    return this.addSubcommand(fn);
  }

  addSubcommandGroups(fn) {
    return this.addSubcommandGroup(fn);
  }
} 

module.exports = { SlashCommandBuilder };
