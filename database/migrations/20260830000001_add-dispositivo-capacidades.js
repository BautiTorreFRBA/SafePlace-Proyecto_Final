/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * P4 / S4 del rediseño de Mediciones: la UI mostraba columnas de temperatura
 * y SpO2 que ningún wearable real puede poblar (la banda de pecho en modo
 * broadcast de FC sólo transmite el Heart Rate Service BLE). En vez de
 * inferir capacidades del modelo con un mapa frágil, se guardan explícitas
 * por dispositivo.
 *
 * `capacidades` (jsonb): qué biodatos puede medir el wearable. Forma:
 *   { "fc": true, "temperatura": false, "spo2": false }
 *
 * Default para altas nuevas: sólo FC (el caso común hoy). Un wearable
 * multiparamétrico se edita desde Admin -> Wearables.
 *
 * Backfill: los 8 dispositivos actuales son bandas de un solo parámetro.
 *
 * Idempotente (IF NOT EXISTS) para ser no-op contra la base de Neon si ya se
 * aplicó a mano, igual que 20260730000009 / 20260801000003.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE dispositivo
      ADD COLUMN IF NOT EXISTS capacidades jsonb NOT NULL
      DEFAULT '{"fc": true, "temperatura": false, "spo2": false}'::jsonb;

    UPDATE dispositivo
    SET capacidades = '{"fc": true, "temperatura": false, "spo2": false}'::jsonb
    WHERE capacidades IS NULL
       OR capacidades = '{}'::jsonb;
  `);
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE dispositivo DROP COLUMN IF EXISTS capacidades;');
};
