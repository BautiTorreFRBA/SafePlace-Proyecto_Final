/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * tipo_alerta: catálogo fijo de los 3 tipos de riesgo que detecta el Motor
 * de Reglas (H0010 fatiga, H0011 sobreesfuerzo, H0012 inactividad
 * prolongada). Prioridad copiada de la descripción de cada historia:
 * fatiga e inactividad -> Media, sobreesfuerzo -> Crítica (única marcada
 * explícitamente como "crítica" en los criterios de aceptación).
 *
 * No existe en el esquema real de Neon — infraestructura nueva de esta
 * historia. `alerts.repository.js`/`dashboard.repository.js` ya hacen JOIN
 * contra esta tabla (`ta.id`, `ta.nombre`, `ta.prioridad`) desde antes de
 * que existiera: este es el contrato de columnas que esperan.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('tipo_alerta', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'varchar(40)', notNull: true, unique: true },
    prioridad: { type: 'varchar(20)', notNull: true },
  });

  pgm.sql(`
    INSERT INTO tipo_alerta (nombre, prioridad) VALUES
      ('FATIGA', 'Media'),
      ('SOBREESFUERZO', 'Crítica'),
      ('INACTIVIDAD_PROLONGADA', 'Media');
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('tipo_alerta');
};
