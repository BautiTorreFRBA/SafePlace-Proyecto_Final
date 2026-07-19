if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL no está definida. Ver services/backend-api/tests/README.md.',
  );
}

// config/database.js lee DATABASE_URL; en los tests la apuntamos a la base de test.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { getPool } = require('../../src/config/database');

// Orden: primero las tablas "hoja" (con FKs hacia las demás), para que el
// CASCADE no dependa de un orden particular; RESTART IDENTITY reinicia los
// seriales para que los IDs sean predecibles entre corridas de tests.
const TABLAS = [
  'registro_consentimiento',
  'log_auditoria',
  'notificacion',
  'intervencion',
  'alerta_historial_estado',
  'alerta',
  'regla_alerta',
  'medicion',
  'historial_estado_dispositivo',
  'asignacion_dispositivo',
  'dispositivo',
  'usuario_rol',
  'usuario',
  'trabajador',
  'empresa',
  'tipo_alerta',
  'rol',
];

const truncarTodo = async () => {
  await getPool().query(`TRUNCATE TABLE ${TABLAS.join(', ')} RESTART IDENTITY CASCADE;`);
};

const cerrarPool = async () => {
  await getPool().end();
};

module.exports = {
  truncarTodo,
  cerrarPool,
};
