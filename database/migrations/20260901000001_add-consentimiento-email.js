/* eslint-disable camelcase */

exports.shorthands = undefined;

// El email pertenece al operario y las solicitudes quedan separadas del
// historial legal: una solicitud pendiente nunca cuenta como consentimiento.
exports.up = (pgm) => {
  pgm.addColumn('operario', {
    email: { type: 'varchar(254)' },
  });

  pgm.createTable('solicitud_consentimiento', {
    id: { type: 'serial', primaryKey: true },
    id_operario: {
      type: 'integer',
      notNull: true,
      references: 'operario',
      onDelete: 'CASCADE',
    },
    token_hash: { type: 'varchar(64)', notNull: true, unique: true },
    version_politica: { type: 'varchar(20)', notNull: true },
    expira_en: { type: 'timestamptz', notNull: true },
    usado_en: { type: 'timestamptz' },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('solicitud_consentimiento', ['id_operario', 'creado_en']);
};

exports.down = (pgm) => {
  pgm.dropTable('solicitud_consentimiento');
  pgm.dropColumn('operario', 'email');
};
