/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * horario_operario admite ahora excepciones puntuales por fecha de
 * calendario, además de las ventanas recurrentes por día de la semana:
 * `fecha IS NULL` => fila recurrente (comportamiento existente, usa
 * dia_semana). `fecha IS NOT NULL` => excepción para esa fecha puntual,
 * que tiene prioridad sobre la recurrente y puede superponerse con ella
 * (la reemplaza para ese día en particular) — sólo no puede superponerse
 * con otra excepción de la misma fecha (validado en horarioOperario.service).
 *
 * Idempotente porque corre contra Neon real.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE horario_operario ADD COLUMN IF NOT EXISTS fecha date;
    CREATE INDEX IF NOT EXISTS horario_operario_id_operario_fecha_index
      ON horario_operario (id_operario, fecha);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS horario_operario_id_operario_fecha_index;
    ALTER TABLE horario_operario DROP COLUMN IF EXISTS fecha;
  `);
};
