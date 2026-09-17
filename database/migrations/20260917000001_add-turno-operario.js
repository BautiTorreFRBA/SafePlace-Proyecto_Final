/* eslint-disable camelcase */

exports.shorthands = undefined;

// Turno operativo asignado al dar de alta un operario. El valor por defecto
// conserva la validez de los registros existentes al aplicar la migración.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE operario
      ADD COLUMN IF NOT EXISTS turno varchar(10) NOT NULL DEFAULT 'mañana';

    ALTER TABLE operario
      DROP CONSTRAINT IF EXISTS operario_turno_valido;

    ALTER TABLE operario
      ADD CONSTRAINT operario_turno_valido
      CHECK (turno IN ('mañana', 'tarde', 'noche'));
  `);
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE operario DROP CONSTRAINT IF EXISTS operario_turno_valido;');
  pgm.sql('ALTER TABLE operario DROP COLUMN IF EXISTS turno;');
};
