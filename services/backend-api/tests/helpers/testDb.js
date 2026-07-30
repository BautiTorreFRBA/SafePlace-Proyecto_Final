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
//
// Nota: el DER completo define también intervencion/alerta_historial_estado/
// regla_alerta, pero esas tablas nunca tuvieron migración (fuera del alcance
// de las historias implementadas hasta ahora) — truncarlas rompería esta
// suite con "relation does not exist". `trabajador` tampoco existe: la tabla
// real es `operario`.
//
// `tipo_alerta` NO se trunca a propósito: es un catálogo fijo sembrado una
// sola vez por la migración (FATIGA/SOBREESFUERZO/INACTIVIDAD_PROLONGADA,
// H0010-H0013) — el Motor de Reglas lo busca por nombre en cada evaluación,
// truncarlo lo dejaría sin filas entre tests (mismo motivo por el que `rol`
// tampoco debería truncarse, aunque eso es preexistente a esta historia).
const TABLAS = [
  'registro_consentimiento',
  'log_auditoria',
  'notificacion',
  'alerta',
  'medicion',
  'operario_seudonimo',
  'umbral_riesgo',
  'historial_estado_dispositivo',
  'asignacion_dispositivo',
  'dispositivo',
  'usuario_rol',
  'usuario',
  'operario',
  'empresa',
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
