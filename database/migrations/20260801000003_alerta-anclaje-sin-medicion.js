/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * Hasta ahora toda alerta nacía de una medición concreta (motor de reglas:
 * fatiga / sobreesfuerzo). La alerta de inactividad prolongada de CP-E2E-04
 * NO tiene medición asociada: nace de la ausencia de datos (wearable
 * desconectado). Se necesita poder anclar la alerta directamente al
 * seudónimo del operario.
 *
 * - id_medicion pasa a ser opcional (en Neon ya lo es; en local no).
 * - id_seudonimo (nuevo, opcional) ancla la alerta al operario sin medición,
 *   manteniendo la seudonimización de H0020.
 * - CHECK: toda alerta tiene al menos uno de los dos anclajes.
 *
 * Los repositorios de lectura resuelven la identidad con
 * COALESCE(medicion.id_seudonimo, alerta.id_seudonimo).
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE alerta ALTER COLUMN id_medicion DROP NOT NULL;

    ALTER TABLE alerta
      ADD COLUMN IF NOT EXISTS id_seudonimo integer REFERENCES operario_seudonimo;

    CREATE INDEX IF NOT EXISTS alerta_id_seudonimo_index ON alerta (id_seudonimo);

    ALTER TABLE alerta DROP CONSTRAINT IF EXISTS alerta_anclaje_presente;
    ALTER TABLE alerta
      ADD CONSTRAINT alerta_anclaje_presente
      CHECK (id_medicion IS NOT NULL OR id_seudonimo IS NOT NULL);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE alerta DROP CONSTRAINT IF EXISTS alerta_anclaje_presente;
    DROP INDEX IF EXISTS alerta_id_seudonimo_index;
    ALTER TABLE alerta DROP COLUMN IF EXISTS id_seudonimo;
  `);
};
