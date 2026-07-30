/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * medicion: tabla base de mediciones biométricas (H0006/H0008/H0009).
 *
 * Nunca existió una migración local para esta tabla — sólo
 * `20260719000001_add-medicion-duplicados-index.js`, que asume que ya
 * existe. Columnas copiadas exactas del esquema real de Neon (introspección
 * read-only, mismo procedimiento que en H0022/H0019): la columna de
 * actividad se llama `actividad` (varchar), no `nivel_actividad`/
 * `nivel_inactividad` como asumía el código antes de esta historia.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('medicion', {
    id: { type: 'serial', primaryKey: true },
    id_trabajador: {
      type: 'integer',
      notNull: true,
      references: 'operario',
      onDelete: 'CASCADE',
    },
    id_dispositivo: {
      type: 'integer',
      notNull: true,
      references: 'dispositivo',
      onDelete: 'RESTRICT',
    },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    frecuencia_cardiaca: { type: 'integer' },
    actividad: { type: 'varchar(40)' },
    temperatura_corporal: { type: 'numeric' },
    spo2: { type: 'numeric' },
    estado: { type: 'varchar(40)' },
  });

  pgm.createIndex('medicion', 'fecha_hora');
  pgm.createIndex('medicion', 'id_trabajador');
};

exports.down = (pgm) => {
  pgm.dropTable('medicion');
};
