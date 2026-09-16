const db = require('../config/database');

// CP-E2E-04: cuándo el chequeo periódico NOTÓ por primera vez que este
// dispositivo está desconectado — el reloj de tolerancia cuenta desde acá,
// no desde el evento histórico en historial_estado_dispositivo (ver
// migración 20260916000001). Idempotente: si ya había un candidato para
// este dispositivo, se devuelve la fila existente sin tocarla.
const marcarPrimeraDeteccion = async (idDispositivo) => {
  const insertado = await db.query(
    `INSERT INTO inactividad_candidato (id_dispositivo)
     VALUES ($1)
     ON CONFLICT (id_dispositivo) DO NOTHING
     RETURNING primera_deteccion, alertado;`,
    [idDispositivo],
  );
  if (insertado.rows[0]) return insertado.rows[0];

  const existente = await db.query(
    'SELECT primera_deteccion, alertado FROM inactividad_candidato WHERE id_dispositivo = $1;',
    [idDispositivo],
  );
  return existente.rows[0] || null;
};

// Un episodio de desconexión avisa UNA sola vez. Cerrar la alerta a mano (o
// que se atienda) no reabre la ventana: mientras el dispositivo siga sin
// reconectar, el chequeo periódico no vuelve a generar otra para el mismo
// corte — recién una reconexión real (limpiar) habilita el próximo aviso.
const marcarAlertado = async (idDispositivo) => {
  await db.query('UPDATE inactividad_candidato SET alertado = true WHERE id_dispositivo = $1;', [idDispositivo]);
};

// Al reconectar, el próximo corte tiene que arrancar el reloj de cero.
const limpiar = async (idDispositivo) => {
  await db.query('DELETE FROM inactividad_candidato WHERE id_dispositivo = $1;', [idDispositivo]);
};

module.exports = {
  marcarPrimeraDeteccion,
  marcarAlertado,
  limpiar,
};
