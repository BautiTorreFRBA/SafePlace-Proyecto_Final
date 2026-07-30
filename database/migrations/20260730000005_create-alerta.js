/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * alerta: registro centralizado de las anomalías detectadas por el Motor de
 * Reglas (H0013 — "historia transversal encargada de centralizar y
 * administrar las alertas generadas por H0010, H0011 y H0012").
 *
 * No existe en el esquema real de Neon — infraestructura nueva de esta
 * historia, pero `alerts.repository.js`/`dashboard.repository.js` ya asumen
 * este contrato exacto (`a.id_tipo_alerta`, `a.id_medicion`, `a.fecha_hora`,
 * `a.estado`) desde antes de que la tabla existiera.
 *
 * La identidad del trabajador NO se guarda acá: se resuelve, como ya hacen
 * esos repositorios, vía `alerta -> medicion -> operario_seudonimo ->
 * operario` (H0020) — no se rompe la seudonimización para mostrar el nombre
 * en la bandeja de alertas.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('alerta', {
    id: { type: 'serial', primaryKey: true },
    id_tipo_alerta: {
      type: 'integer',
      notNull: true,
      references: 'tipo_alerta',
      onDelete: 'RESTRICT',
    },
    id_medicion: {
      type: 'integer',
      notNull: true,
      references: 'medicion',
      onDelete: 'CASCADE',
    },
    // 'Activa' | 'Atendida' | 'Cerrada' (H0013). No es un enum de Postgres a
    // propósito: mismo criterio que medicion.estado/historial_estado_dispositivo.estado,
    // varchar libre validado en la capa de servicio.
    estado: { type: 'varchar(20)', notNull: true, default: 'Activa' },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('alerta', 'id_medicion');
  // H0013: "no se generan alertas duplicadas para una misma condición
  // activa" — el chequeo antiduplicado filtra por tipo + estado antes de
  // insertar; este índice lo resuelve sin escaneo completo de la tabla.
  pgm.createIndex('alerta', ['id_tipo_alerta', 'estado']);
};

exports.down = (pgm) => {
  pgm.dropTable('alerta');
};
