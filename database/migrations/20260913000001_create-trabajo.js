/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * trabajo: tipos de tarea que un operario puede realizar durante una ventana
 * de horario_operario, cada uno con sus propios umbrales de riesgo (mismo
 * shape que umbral_riesgo). Si una ventana de horario_operario no tiene
 * trabajo asignado, se usa el umbral_riesgo global vigente.
 *
 * A diferencia de umbral_riesgo (append-only), trabajo es estado actual: se
 * edita in-place (UPDATE) porque son entidades que el usuario nombra y
 * reutiliza, no versiones de "la" configuración global — mismo criterio que
 * horario_operario.
 *
 * No existe en el esquema real de Neon — infraestructura nueva.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('trabajo', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'text', notNull: true },
    descripcion: { type: 'text' },
    activo: { type: 'boolean', notNull: true, default: true },
    fc_fatiga: { type: 'integer', notNull: true },
    minutos_fatiga: { type: 'integer', notNull: true },
    fc_sobreesfuerzo: { type: 'integer', notNull: true },
    actividad_sobreesfuerzo: { type: 'numeric', notNull: true },
    minutos_inactividad: { type: 'integer', notNull: true },
    minutos_desconexion_tolerada: { type: 'integer', notNull: true },
    id_usuario: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('trabajo', 'trabajo_nombre_unique', {
    unique: ['nombre'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('trabajo');
};
