const db = require('../config/database');

// CP-E2E-04: cuándo el chequeo periódico NOTÓ por primera vez que este
// dispositivo está desconectado — el reloj de tolerancia cuenta desde acá,
// no desde el evento histórico en historial_estado_dispositivo (ver
// migración 20260916000001). Idempotente: si ya había un candidato para
// este dispositivo, se devuelve su primera_deteccion sin tocarla.
const marcarPrimeraDeteccion = async (idDispositivo) => {
  const insertado = await db.query(
    `INSERT INTO inactividad_candidato (id_dispositivo)
     VALUES ($1)
     ON CONFLICT (id_dispositivo) DO NOTHING
     RETURNING primera_deteccion;`,
    [idDispositivo],
  );
  if (insertado.rows[0]) return insertado.rows[0].primera_deteccion;

  const existente = await db.query(
    'SELECT primera_deteccion FROM inactividad_candidato WHERE id_dispositivo = $1;',
    [idDispositivo],
  );
  return existente.rows[0]?.primera_deteccion || null;
};

// Al reconectar, el próximo corte tiene que arrancar el reloj de cero.
const limpiar = async (idDispositivo) => {
  await db.query('DELETE FROM inactividad_candidato WHERE id_dispositivo = $1;', [idDispositivo]);
};

module.exports = {
  marcarPrimeraDeteccion,
  limpiar,
};
