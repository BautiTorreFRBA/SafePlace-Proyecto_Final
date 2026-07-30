/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * H0003/H0026: "el sistema registra fecha de desactivación" y "el sistema
 * registra quién realizó la baja" — ninguna de las dos tablas tenía estas
 * columnas; la desactivación sólo tocaba el flag `activo`/`estado`.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumns('usuario', {
    fecha_baja: { type: 'timestamptz' },
    dado_de_baja_por: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
  });

  pgm.addColumns('operario', {
    fecha_baja: { type: 'timestamptz' },
    dado_de_baja_por: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('operario', ['fecha_baja', 'dado_de_baja_por']);
  pgm.dropColumns('usuario', ['fecha_baja', 'dado_de_baja_por']);
};
