/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * historial_estado_dispositivo: registro histórico del estado de conexión
 * de cada wearable (H0007). Ya existía en el esquema real de Neon (columnas
 * copiadas exactas por introspección read-only) pero nunca tuvo migración
 * local ni código que la usara — es prerequisito de H0007 (estado de
 * conexión visible para el administrador) y de la detección de desconexión
 * por inactividad de H0006.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('historial_estado_dispositivo', {
    id: { type: 'serial', primaryKey: true },
    id_dispositivo: {
      type: 'integer',
      notNull: true,
      references: 'dispositivo',
      onDelete: 'CASCADE',
    },
    estado: { type: 'varchar(20)', notNull: true },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('historial_estado_dispositivo', 'id_dispositivo');
};

exports.down = (pgm) => {
  pgm.dropTable('historial_estado_dispositivo');
};
