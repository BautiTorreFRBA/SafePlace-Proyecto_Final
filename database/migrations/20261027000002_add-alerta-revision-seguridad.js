/* eslint-disable camelcase */

// Segundo chequeo de Seguridad e Higiene: el supervisor atiende la alerta
// (id_usuario_atendio) y el Responsable la revisa después. Mientras
// id_usuario_reviso sea NULL la alerta sigue figurando como "Activa" en su bandeja.
exports.up = (pgm) => {
  pgm.addColumns('alerta', {
    id_usuario_reviso: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
    fecha_revision: { type: 'timestamptz' },
  });
  pgm.createIndex('alerta', 'id_usuario_reviso');
};

exports.down = (pgm) => {
  pgm.dropIndex('alerta', 'id_usuario_reviso');
  pgm.dropColumns('alerta', ['id_usuario_reviso', 'fecha_revision']);
};
