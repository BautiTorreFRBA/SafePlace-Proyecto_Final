/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS area_supervisada varchar(100),
      ADD COLUMN IF NOT EXISTS turnos_supervisados varchar(10)[];

    ALTER TABLE usuario
      DROP CONSTRAINT IF EXISTS usuario_turnos_supervisados_validos;

    ALTER TABLE usuario
      ADD CONSTRAINT usuario_turnos_supervisados_validos
      CHECK (
        turnos_supervisados IS NULL
        OR turnos_supervisados <@ ARRAY['mañana', 'tarde', 'noche']::varchar[]
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_turnos_supervisados_validos;
    ALTER TABLE usuario
      DROP COLUMN IF EXISTS turnos_supervisados,
      DROP COLUMN IF EXISTS area_supervisada;
  `);
};
