/* eslint-disable camelcase */

exports.shorthands = undefined;

// Configuración vigente de las únicas reglas editables desde Administración.
// Los parámetros se guardan en JSONB porque cada tipo tiene umbrales distintos.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS regla_alerta (
      id serial PRIMARY KEY,
      tipo varchar(30) NOT NULL UNIQUE,
      parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
      id_usuario integer REFERENCES usuario ON DELETE SET NULL,
      fecha_hora timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT regla_alerta_tipo_check
        CHECK (tipo IN ('FATIGA', 'INACTIVIDAD', 'SOBREESFUERZO'))
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS regla_alerta;');
};
