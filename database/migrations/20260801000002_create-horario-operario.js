/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * horario_operario (CP-E2E-04 / H0012): ventana horaria en la que se espera
 * que el wearable del operario esté conectado. La alerta de inactividad
 * prolongada sólo se genera si la desconexión ocurre DENTRO de esta ventana.
 *
 * Alcance elegido: por operario (no global ni por empresa). Una ventana por
 * día de la semana (ISODOW 1=lunes .. 7=domingo). Turnos partidos o que
 * cruzan la medianoche quedan fuera del MVP: se exige hora_fin > hora_inicio.
 *
 * A diferencia de umbral_riesgo / registro_consentimiento, esta tabla NO es
 * append-only: un horario es estado actual, se edita in-place (upsert por
 * operario+día) y cada cambio se audita en log_auditoria desde la capa de
 * servicio.
 *
 * No existe en el esquema real de Neon — infraestructura nueva de esta
 * historia.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('horario_operario', {
    id: { type: 'serial', primaryKey: true },
    id_operario: {
      type: 'integer',
      notNull: true,
      references: 'operario',
      onDelete: 'CASCADE',
    },
    dia_semana: { type: 'smallint', notNull: true },
    hora_inicio: { type: 'time', notNull: true },
    hora_fin: { type: 'time', notNull: true },
  });

  pgm.addConstraint('horario_operario', 'horario_operario_dia_valido', {
    check: 'dia_semana BETWEEN 1 AND 7',
  });
  pgm.addConstraint('horario_operario', 'horario_operario_rango_valido', {
    check: 'hora_fin > hora_inicio',
  });
  pgm.addConstraint('horario_operario', 'horario_operario_operario_dia_unique', {
    unique: ['id_operario', 'dia_semana'],
  });
  pgm.createIndex('horario_operario', 'id_operario');
};

exports.down = (pgm) => {
  pgm.dropTable('horario_operario');
};
