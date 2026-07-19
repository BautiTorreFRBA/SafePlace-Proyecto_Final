/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * registro_consentimiento: registro histórico auditable del consentimiento
 * digital de cada trabajador (RF-16 / H0019 / RNF-09, Ley 25.326).
 *
 * Infraestructura mínima de LECTURA requerida por el Servicio de Validación
 * de Datos (RF-04): el bloqueo por privacidad exige consultar un flag de
 * consentimiento antes de procesar cada paquete. El ABM/endpoint de registro
 * de consentimiento (historia H0019) queda pendiente de implementación; esta
 * tabla no existía en el DER v1.1 ni en el código y es prerequisito real.
 *
 * Es append-only a nivel de aplicación (RF-16: sin edición ni borrado una
 * vez creado): el repositorio sólo expone alta y consulta. El estado vigente
 * de un trabajador es el registro más reciente (estado true = otorgado,
 * false = revocado); sin registros = sin consentimiento.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('registro_consentimiento', {
    id: { type: 'serial', primaryKey: true },
    id_trabajador: {
      type: 'integer',
      notNull: true,
      references: 'trabajador',
      onDelete: 'RESTRICT',
    },
    estado: { type: 'boolean', notNull: true },
    version_politica: { type: 'varchar(20)', notNull: true },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // La consulta del flag vigente es "último registro del trabajador":
  // índice compuesto para resolverla sin escaneo (RNF-09 / RNF-01).
  pgm.createIndex('registro_consentimiento', ['id_trabajador', 'fecha_hora']);
};

exports.down = (pgm) => {
  pgm.dropTable('registro_consentimiento');
};
