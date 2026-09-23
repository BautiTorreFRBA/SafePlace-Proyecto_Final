/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * `minutos_fatiga` era `integer`, así que la ventana de sostenimiento de
 * H0010 (FATIGA) sólo podía configurarse en minutos enteros — un mínimo
 * demasiado grueso (ver sesión-qa-hub-ble-2026-09-16, prueba de FATIGA del
 * 22/09: no hay forma de pedir, por ejemplo, "20 segundos sostenido").
 * Pasa a `numeric` en ambas tablas que lo usan (umbral_riesgo global y
 * trabajo, ver umbralEfectivo.service) para admitir fracciones de minuto.
 *
 * Idempotente porque corre contra Neon real, mismo criterio que el resto de
 * las migraciones de esta serie.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE umbral_riesgo ALTER COLUMN minutos_fatiga TYPE numeric;
    ALTER TABLE trabajo ALTER COLUMN minutos_fatiga TYPE numeric;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE umbral_riesgo ALTER COLUMN minutos_fatiga TYPE integer USING round(minutos_fatiga)::integer;
    ALTER TABLE trabajo ALTER COLUMN minutos_fatiga TYPE integer USING round(minutos_fatiga)::integer;
  `);
};
