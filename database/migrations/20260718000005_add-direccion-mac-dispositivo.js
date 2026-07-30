/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * dispositivo.direccion_mac: dirección BLE del wearable físico (H0007).
 *
 * No existe en el esquema real de Neon hoy — es la única columna nueva que
 * se agrega en esta historia (no un ajuste a algo preexistente). Necesaria
 * para que el hub (que identifica wearables por MAC) pueda resolver el
 * `dispositivo.id` real vía `GET /api/v1/dispositivos/lookup`. Nullable
 * porque no todo dispositivo cargado tiene por qué tener su MAC asociada
 * todavía (no hay alta de wearables automatizada, se carga a mano desde
 * la pantalla de estado de conexión).
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('dispositivo', {
    direccion_mac: { type: 'varchar(17)', unique: true },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('dispositivo', 'direccion_mac');
};
