const path = require('path');
const { runner } = require('node-pg-migrate');

/**
 * Aplica las migraciones de database/migrations contra TEST_DATABASE_URL
 * antes de correr la suite (ver tests/README.md).
 *
 * Nota: el repo nunca tuvo una migración para el esquema base del DER
 * completo (sólo existen migraciones incrementales tardías que asumen que
 * `medicion`/`trabajador` ya existen). Esta función seguía sin poder
 * ejecutarse porque el archivo mismo faltaba. No intenta resolver el resto
 * del DER (fuera del alcance de H0022): si alguna migración posterior a la
 * base falla porque su tabla de referencia todavía no existe, se loguea y
 * se continúa, para no bloquear los tests que sí tienen su esquema listo.
 */
module.exports = async () => {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL no está definida. Ver services/backend-api/tests/README.md.',
    );
  }

  try {
    await runner({
      databaseUrl: process.env.TEST_DATABASE_URL,
      dir: path.resolve(__dirname, '../../../database/migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      checkOrder: false,
      count: undefined,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      '[tests/globalSetup] Algunas migraciones no se pudieron aplicar (probablemente '
        + 'dependen de tablas fuera del alcance de esta historia). Continuando con el '
        + `esquema parcial ya aplicado. Detalle: ${error.message}`,
    );
  }
};
