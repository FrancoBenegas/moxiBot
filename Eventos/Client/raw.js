const Moxi = require("../../index");
const logger = require("../../Util/logger");

// Este evento es CRÍTICO para Poru.
// Sin él, el bot no puede actualizar las sesiones de voz de Discord
// y el audio no se reproducirá.

Moxi.on('raw', async (packet) => {
  try {
    // Poru necesita VOICE_STATE_UPDATE y VOICE_SERVER_UPDATE
    // para mantener las sesiones de voz sincronizadas.
    if (!packet || !packet.d) return;

    if (packet.t === 'VOICE_STATE_UPDATE' || packet.t === 'VOICE_SERVER_UPDATE') {
      // Poru.packetUpdate() procesa estos eventos
      if (Moxi.poru && typeof Moxi.poru.packetUpdate === 'function') {
        Moxi.poru.packetUpdate(packet);
      }

      // Debug: solo si está habilitado
      if (logger.isDebugFlagEnabled('poru')) {
        const guildId = packet.d?.guild_id || packet.d?.guildId || '?';
        logger.debug(`[PORU:RAW] ${packet.t} | guild=${guildId}`);
      }
    }
  } catch (error) {
    logger.error('[PORU:RAW] Error processing raw packet:', error);
  }
});
