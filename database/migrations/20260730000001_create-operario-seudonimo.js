/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * operario_seudonimo: tabla separada y protegida que mantiene la única
 * correspondencia entre la identidad civil del trabajador (operario) y el
 * identificador seudonimizado usado para almacenar sus datos biométricos
 * (H0020 / RNF-09, Ley 25.326).
 *
 * No existe en el esquema real de Neon hoy — es infraestructura nueva de
 * esta historia, no una tabla preexistente. Un operario tiene a lo sumo un
 * seudónimo (unique en id_operario): se genera una sola vez, la primera vez
 * que se procesa una medición suya, y se reutiliza siempre después.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('operario_seudonimo', {
    id: { type: 'serial', primaryKey: true },
    id_operario: {
      type: 'integer',
      notNull: true,
      unique: true,
      references: 'operario',
      onDelete: 'CASCADE',
    },
    // Identificador opaco (32 bytes aleatorios en hex): no es función del
    // id de operario ni de ningún otro dato civil, para que no sea derivable.
    identificador_seudonimo: { type: 'varchar(64)', notNull: true, unique: true },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('operario_seudonimo');
};
