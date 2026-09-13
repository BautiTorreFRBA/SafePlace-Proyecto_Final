/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * Asocia opcionalmente cada ventana de horario_operario a un `trabajo`. Si
 * queda en null (por defecto, o porque el trabajo referenciado se borró) la
 * ventana usa el umbral_riesgo global vigente — ver umbralEfectivo.service.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS) porque corre contra Neon real, mismo
 * criterio que 20260801000001_extend-umbral-riesgo-desconexion.js.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE horario_operario
      ADD COLUMN IF NOT EXISTS id_trabajo integer REFERENCES trabajo ON DELETE SET NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE horario_operario DROP COLUMN IF EXISTS id_trabajo;');
};
