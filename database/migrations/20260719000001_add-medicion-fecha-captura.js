/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * Soporte del Servicio de Validación de Datos (RF-04 / H0008).
 *
 * - fecha_hora_captura: marca de tiempo generada por el wearable/gateway al
 *   capturar la medición. Se conserva como dato adicional; la marca de tiempo
 *   oficial de trazabilidad sigue siendo fecha_hora, asignada por el backend
 *   al recibir el paquete (RF-03).
 * - Índice único (id_dispositivo, fecha_hora_captura): criterio de duplicado
 *   de H0008 ("No se aceptan registros duplicados"). El DER v1.1 no define un
 *   criterio propio y el par wearable+timestamp de recepción nunca colisiona
 *   (lo asigna el backend), por lo que el duplicado real es el reenvío del
 *   mismo paquete por la cola/reintentos del gateway: mismo dispositivo y
 *   misma marca de captura. El índice permite detectarlo sin escanear la
 *   tabla (RNF-01) y actúa como defensa ante condiciones de carrera.
 *   Parcial (IS NOT NULL) para no afectar filas históricas sin captura.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('medicion', {
    fecha_hora_captura: { type: 'timestamptz' },
  });

  pgm.createIndex('medicion', ['id_dispositivo', 'fecha_hora_captura'], {
    name: 'medicion_dispositivo_captura_unique',
    unique: true,
    where: 'fecha_hora_captura IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('medicion', ['id_dispositivo', 'fecha_hora_captura'], {
    name: 'medicion_dispositivo_captura_unique',
  });
  pgm.dropColumn('medicion', 'fecha_hora_captura');
};
