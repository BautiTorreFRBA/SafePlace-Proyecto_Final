/* eslint-disable camelcase */

// La base productiva ya posee este campo; se declara también en migraciones
// para que los entornos nuevos y de pruebas tengan el mismo contrato.
exports.up = (pgm) => {
  pgm.sql('ALTER TABLE alerta ADD COLUMN IF NOT EXISTS atendida TEXT;');
};

exports.down = (pgm) => {
  pgm.dropColumn('alerta', 'atendida', { ifExists: true });
};
