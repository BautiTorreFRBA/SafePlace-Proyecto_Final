/* eslint-disable camelcase */

exports.shorthands = undefined;

// Sexo del operario, opcional: el Home del administrador lo usa para elegir la
// ilustración de la tarjeta (masculino/femenino). NULL = sin cargar, se muestra
// un avatar neutro.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE operario
      ADD COLUMN IF NOT EXISTS sexo varchar(10);

    ALTER TABLE operario
      DROP CONSTRAINT IF EXISTS operario_sexo_valido;

    ALTER TABLE operario
      ADD CONSTRAINT operario_sexo_valido
      CHECK (sexo IS NULL OR sexo IN ('masculino', 'femenino'));
  `);
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE operario DROP CONSTRAINT IF EXISTS operario_sexo_valido;');
  pgm.sql('ALTER TABLE operario DROP COLUMN IF EXISTS sexo;');
};
