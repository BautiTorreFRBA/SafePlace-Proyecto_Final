/* eslint-disable camelcase */

// Segundo chequeo de Seguridad e Higiene: id_usuario_atendio guarda al supervisor
// que atendió la alerta e id_usuario_reviso al Responsable que la atendió o cerró.
exports.up = (pgm) => {
  pgm.addColumn('alerta', {
    id_usuario_reviso: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
  });
  pgm.createIndex('alerta', 'id_usuario_reviso');
};

exports.down = (pgm) => {
  pgm.dropIndex('alerta', 'id_usuario_reviso');
  pgm.dropColumn('alerta', 'id_usuario_reviso');
};
