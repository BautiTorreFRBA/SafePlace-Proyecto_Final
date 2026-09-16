/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * inactividad_candidato: cuándo el chequeo periódico de CP-E2E-04 NOTÓ por
 * primera vez que un dispositivo está desconectado — distinto de
 * historial_estado_dispositivo.fecha_hora, que es cuándo ocurrió la
 * desconexión real.
 *
 * Sin esto, el chequeo comparaba `now() - fecha_hora_del_evento` contra la
 * tolerancia: un dispositivo que llevaba rato desconectado desde ANTES de
 * que arrancara el chequeo (por ejemplo, entre dos sesiones de prueba)
 * disparaba la alerta apenas el sistema volvía a mirar, aunque nadie lo
 * hubiera estado "viendo" desconectado ese tiempo. Ahora el reloj de
 * tolerancia arranca en la primera detección, no en el evento histórico —
 * "una vez conectado, se desconecta por la tolerancia" se cumple recién si
 * el sistema lo observó desconectado ese tiempo, no por datos viejos.
 *
 * Fila por dispositivo: se crea en la primera detección (chequear()) y se
 * borra al reconectar (resolverPorReconexion()), así el próximo corte
 * arranca el reloj de cero.
 *
 * No existe en el esquema real de Neon — infraestructura nueva.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('inactividad_candidato', {
    id_dispositivo: {
      type: 'integer',
      primaryKey: true,
      references: 'dispositivo',
      onDelete: 'CASCADE',
    },
    primera_deteccion: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('inactividad_candidato');
};
