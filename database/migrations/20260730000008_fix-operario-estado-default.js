/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * Bug: `operario.estado` no tenía DEFAULT y crearEmpleado() no lo seteaba,
 * así que todo operario creado hasta ahora quedó con estado = NULL en vez
 * de activo. Eso bloqueaba H0022 (asociaciones.service exige
 * `trabajador.estado === true` para asociar un wearable).
 *
 * NULL acá sólo puede significar "nunca se desactivó explícitamente" — toda
 * baja real ya pasa por desactivarEmpleado(), que setea estado = FALSE. Por
 * eso el backfill a TRUE es seguro: no reactiva a nadie que haya sido dado
 * de baja de verdad.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql('UPDATE operario SET estado = TRUE WHERE estado IS NULL;');
  pgm.alterColumn('operario', 'estado', { default: true });
};

exports.down = (pgm) => {
  pgm.alterColumn('operario', 'estado', { default: null });
};
