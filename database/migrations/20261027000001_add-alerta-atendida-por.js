/* eslint-disable camelcase */

// Conserva quién atendió una alerta para que Seguridad e Higiene pueda hacer
// seguimiento operativo sin depender del historial de sesión del supervisor.
exports.up = (pgm) => {
  pgm.addColumn('alerta', {
    id_usuario_atendio: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
  });
  pgm.createIndex('alerta', 'id_usuario_atendio');
};

exports.down = (pgm) => {
  pgm.dropIndex('alerta', 'id_usuario_atendio');
  pgm.dropColumn('alerta', 'id_usuario_atendio');
};
