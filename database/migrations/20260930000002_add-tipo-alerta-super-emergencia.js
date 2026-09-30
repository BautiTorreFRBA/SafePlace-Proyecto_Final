/* eslint-disable camelcase */

exports.shorthands = undefined;

// Tipo de alerta SUPER_EMERGENCIA ("super super alerta"): la genera alertas.service
// cuando un operario acumula más de dos EMERGENCIA en la ventana. Prioridad Crítica.
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO tipo_alerta (nombre, prioridad)
    VALUES ('SUPER_EMERGENCIA', 'Crítica')
    ON CONFLICT (nombre) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM tipo_alerta t
    WHERE t.nombre = 'SUPER_EMERGENCIA'
      AND NOT EXISTS (SELECT 1 FROM alerta a WHERE a.id_tipo_alerta = t.id);
  `);
};
