/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * notificacion: registro de que una alerta fue empujada al panel operativo
 * del supervisor (H0015). Separada de `alerta` a propósito: son conceptos de
 * consumidores distintos — `alerta` es el registro formal para Seguridad
 * (ciclo Activa/Atendida/Cerrada de H0013); `notificacion` es "¿el
 * supervisor la vio?" en su panel, con su propio estado de lectura.
 *
 * No existe en el esquema real de Neon — infraestructura nueva de esta
 * historia.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('notificacion', {
    id: { type: 'serial', primaryKey: true },
    id_alerta: {
      type: 'integer',
      notNull: true,
      references: 'alerta',
      onDelete: 'CASCADE',
    },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    leida: { type: 'boolean', notNull: true, default: false },
    fecha_lectura: { type: 'timestamptz' },
  });

  pgm.createIndex('notificacion', 'id_alerta');
  // H0015: el panel operativo consulta (con polling) las no leídas más
  // recientes primero.
  pgm.createIndex('notificacion', ['leida', 'fecha_hora']);
};

exports.down = (pgm) => {
  pgm.dropTable('notificacion');
};
