/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * medicion.id_seudonimo (H0020): el almacenamiento de biodatos deja de
 * asociarse a la identidad civil directa (operario.id) y pasa a asociarse
 * al identificador seudonimizado del trabajador (operario_seudonimo.id).
 * La única correspondencia entre ambos queda en operario_seudonimo, no acá.
 *
 * Reemplaza id_trabajador (no coexiste con ella): no hay filas existentes
 * fuera de tests/desarrollo, así que no hace falta backfill.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('medicion', {
    id_seudonimo: {
      type: 'integer',
      notNull: true,
      references: 'operario_seudonimo',
      onDelete: 'RESTRICT',
    },
  });
  pgm.createIndex('medicion', 'id_seudonimo');
  pgm.dropColumn('medicion', 'id_trabajador');
};

exports.down = (pgm) => {
  pgm.addColumn('medicion', {
    id_trabajador: {
      type: 'integer',
      references: 'operario',
      onDelete: 'CASCADE',
    },
  });
  pgm.createIndex('medicion', 'id_trabajador');
  pgm.dropColumn('medicion', 'id_seudonimo');
};
