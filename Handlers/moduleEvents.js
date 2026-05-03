/**
 * Handler de Eventos Modulares
 * Deshabilitado: ya no se registran eventos desde módulos
 */

const logger = require('../Util/logger');

module.exports = async () => {
  logger.info('ℹ️  moduleEvents deshabilitado: los eventos modulares no se registran');
};
