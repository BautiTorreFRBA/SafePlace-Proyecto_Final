/* eslint-disable camelcase */

exports.shorthands = undefined;

// Tipo de alerta EMERGENCIA ("super alerta"): la genera alertas.service cuando un
// operario pasa de fatiga/sobreesfuerzo a inactividad prolongada, o acumula varias
// alertas en una hora. Prioridad Crítica para que todas las pantallas que ya
// filtran por prioridad la traten como crítica.
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO tipo_alerta (nombre, prioridad)
    VALUES ('EMERGENCIA', 'Crítica')
    ON CONFLICT (nombre) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM tipo_alerta t
    WHERE t.nombre = 'EMERGENCIA'
      AND NOT EXISTS (SELECT 1 FROM alerta a WHERE a.id_tipo_alerta = t.id);
  `);
};
