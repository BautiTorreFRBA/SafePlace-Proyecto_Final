/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * inactividad_candidato.alertado: si ya se generó una alerta
 * INACTIVIDAD_PROLONGADA para este episodio de desconexión (desde que se
 * detectó hasta que el dispositivo reconecta y limpia la fila).
 *
 * Sin esto, cerrar la alerta a mano (o que un supervisor la atienda) no
 * detenía el chequeo periódico: si el wearable seguía desconectado, la
 * siguiente vuelta del chequeo volvía a generar una alerta nueva para el
 * mismo corte real, indefinidamente cada tantos minutos. Un episodio de
 * desconexión tiene que avisar UNA sola vez — recién una reconexión real
 * (que borra la fila) habilita que un corte posterior avise de nuevo.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('inactividad_candidato', {
    alertado: { type: 'boolean', notNull: true, default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('inactividad_candidato', 'alertado');
};
