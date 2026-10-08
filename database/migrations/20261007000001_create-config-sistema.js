exports.up = (pgm) => {
  pgm.createTable('config_sistema', {
    id: 'id',
    simulacion_activa: { type: 'boolean', notNull: true, default: false },
    actualizado_por: { type: 'integer', references: '"usuario"', onDelete: 'SET NULL' },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.sql("INSERT INTO config_sistema (simulacion_activa) VALUES (false)");
};

exports.down = (pgm) => {
  pgm.dropTable('config_sistema');
};
