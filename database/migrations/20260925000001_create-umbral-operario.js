/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * umbral_operario ("Configuración particular" en Configuración Operativa):
 * FC de fatiga y de sobreesfuerzo propias de un operario puntual. Todo
 * operario usa el umbral_riesgo global vigente salvo los que tienen una fila
 * acá, que reemplaza sólo esas dos FC (el resto de los parámetros — minutos
 * sostenidos, actividad mínima, inactividad — siguen siendo los globales).
 * Ver umbralEfectivo.service.
 *
 * Estado actual (se edita in-place), una fila por operario, mismo criterio que
 * trabajo / horario_operario.
 *
 * Idempotente porque corre contra Neon real, mismo criterio que el resto de
 * las migraciones de esta serie.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS umbral_operario (
      id serial PRIMARY KEY,
      id_operario integer NOT NULL REFERENCES operario ON DELETE CASCADE,
      fc_fatiga integer NOT NULL CHECK (fc_fatiga > 0),
      fc_sobreesfuerzo integer NOT NULL CHECK (fc_sobreesfuerzo > 0),
      id_usuario integer REFERENCES usuario ON DELETE SET NULL,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT umbral_operario_operario_unique UNIQUE (id_operario)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS umbral_operario;');
};
