/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * umbral_riesgo: configuración de los umbrales que usa el Motor de Reglas
 * para detectar fatiga (H0010), sobreesfuerzo (H0011) e inactividad
 * prolongada (H0012) — configurables desde H0023.
 *
 * Append-only, igual que registro_consentimiento (H0019): "toda modificación
 * registra usuario, fecha y hora" y "los cambios impactan únicamente en
 * nuevas evaluaciones" (H0023) se resuelven mejor con versiones históricas
 * que con UPDATE in-place — la vigente es siempre la fila más reciente, y el
 * historial completo queda consultable sin una tabla de auditoría aparte.
 *
 * No existe en el esquema real de Neon — infraestructura nueva de esta
 * historia.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('umbral_riesgo', {
    id: { type: 'serial', primaryKey: true },
    fc_fatiga: { type: 'integer', notNull: true },
    minutos_fatiga: { type: 'integer', notNull: true },
    fc_sobreesfuerzo: { type: 'integer', notNull: true },
    actividad_sobreesfuerzo: { type: 'numeric', notNull: true },
    minutos_inactividad: { type: 'integer', notNull: true },
    id_usuario: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // La consulta del vigente es "última fila": índice para resolverla sin
  // escaneo (mismo criterio que registro_consentimiento).
  pgm.createIndex('umbral_riesgo', 'fecha_hora');
};

exports.down = (pgm) => {
  pgm.dropTable('umbral_riesgo');
};
