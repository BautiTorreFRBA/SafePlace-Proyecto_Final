/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * Soporte del Servicio de Validación de Datos (RF-04 / H0008).
 *
 * Índice único (id_dispositivo, fecha_hora): criterio de duplicado de H0008
 * ("No se aceptan registros duplicados"). La entidad medicion se mantiene tal
 * cual el DER v1.1 (sin columnas nuevas): fecha_hora cumple el rol de
 * timestamp de la medición y almacena la marca de tiempo que declara el
 * paquete del gateway, por decisión de equipo (18/07/2026). El duplicado real
 * es el reenvío del mismo paquete por la cola/reintentos del gateway: mismo
 * dispositivo y misma marca de tiempo. El índice permite detectarlo sin
 * escanear la tabla (RNF-01) y actúa como defensa ante condiciones de
 * carrera (ON CONFLICT DO NOTHING en el INSERT).
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createIndex('medicion', ['id_dispositivo', 'fecha_hora'], {
    name: 'medicion_dispositivo_fecha_hora_unique',
    unique: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('medicion', ['id_dispositivo', 'fecha_hora'], {
    name: 'medicion_dispositivo_fecha_hora_unique',
  });
};
