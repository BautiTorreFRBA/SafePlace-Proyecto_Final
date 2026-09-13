/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * horario_operario pasa a admitir más de una ventana por (id_operario,
 * dia_semana) — turnos partidos, o distinto trabajo asignado a la mañana y
 * a la tarde del mismo día. La superposición horaria dentro de un mismo día
 * se valida en la capa de servicio (horarioOperario.service), no en el
 * esquema: Postgres no tiene una forma simple de expresar "sin solapamiento
 * de rangos de tiempo" sin extensiones (btree_gist) que no estaban en uso
 * en este proyecto.
 *
 * Idempotente (DROP CONSTRAINT IF EXISTS) porque corre contra Neon real.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE horario_operario
      DROP CONSTRAINT IF EXISTS horario_operario_operario_dia_unique;
  `);
};

exports.down = (pgm) => {
  pgm.addConstraint('horario_operario', 'horario_operario_operario_dia_unique', {
    unique: ['id_operario', 'dia_semana'],
  });
};
