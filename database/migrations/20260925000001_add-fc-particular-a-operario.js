/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * "Configuración particular" de Configuración Operativa: FC de fatiga y de
 * sobreesfuerzo propias de un operario, guardadas en operario."FC_Fatiga" /
 * operario."FC_Sobreesfuerzo". NULL = el operario usa el umbral_riesgo global
 * vigente (ver umbralEfectivo.service).
 *
 * Las columnas ya se crearon a mano en Neon con mayúsculas, por eso van entre
 * comillas (identificadores sensibles a mayúsculas). Idempotente (ADD COLUMN
 * IF NOT EXISTS) para que en Neon sea un no-op y en la base de test las cree
 * igual, mismo criterio que el resto de las migraciones de esta serie.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE operario
      ADD COLUMN IF NOT EXISTS "FC_Fatiga" integer,
      ADD COLUMN IF NOT EXISTS "FC_Sobreesfuerzo" integer;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE operario
      DROP COLUMN IF EXISTS "FC_Fatiga",
      DROP COLUMN IF EXISTS "FC_Sobreesfuerzo";
  `);
};
