/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * CP-E2E-04 / H0012 (reencuadrada): la "inactividad prolongada" deja de
 * inferirse del nivel de movimiento por medición y pasa a definirse como
 * "el wearable estuvo DESCONECTADO más que una tolerancia configurable
 * mientras el operario estaba en horario laboral".
 *
 * La tolerancia es un parámetro global de Seguridad e Higiene, del mismo
 * tenor que los umbrales de fatiga/sobreesfuerzo (H0023), así que vive en
 * umbral_riesgo (append-only: la fila vigente es la más reciente).
 *
 * `minutos_desconexion_tolerada` debe ser mayor que DESCONEXION_MINUTOS
 * (env del backend, default 5) porque recién después de ese lapso el evento
 * DESCONECTADO queda registrado por la inferencia de H0006.
 *
 * Idempotente contra Neon (la columna puede ya existir) y siembra una fila
 * vigente sólo si la tabla está vacía, para que "existe una tolerancia
 * configurada" sea cierto en cualquier entorno limpio (precondición del CP).
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE umbral_riesgo
      ADD COLUMN IF NOT EXISTS minutos_desconexion_tolerada integer NOT NULL DEFAULT 10;
  `);

  // Seed sólo si nunca se configuró nada (no pisa la fila real de Neon).
  pgm.sql(`
    INSERT INTO umbral_riesgo (
      fc_fatiga, minutos_fatiga,
      fc_sobreesfuerzo, actividad_sobreesfuerzo,
      minutos_inactividad, minutos_desconexion_tolerada
    )
    SELECT 130, 10, 160, 0.7, 15, 10
    WHERE NOT EXISTS (SELECT 1 FROM umbral_riesgo);
  `);
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE umbral_riesgo DROP COLUMN IF EXISTS minutos_desconexion_tolerada;');
};
