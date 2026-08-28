const db = require('../config/database');

// Zona horaria de referencia para interpretar el horario laboral (mismo
// criterio que dashboard.repository). Configurable por si se opera en otra.
const TIMEZONE = process.env.HORARIO_TIMEZONE || 'America/Argentina/Buenos_Aires';

const listarPorOperario = async (idOperario) => {
  const res = await db.query(
    `SELECT id, id_operario, dia_semana, hora_inicio, hora_fin
     FROM horario_operario
     WHERE id_operario = $1
     ORDER BY dia_semana;`,
    [idOperario],
  );
  return res.rows;
};

// Reemplaza el horario completo del operario por el conjunto de ventanas
// recibido (una por día). Transaccional: o queda el set nuevo entero, o no
// cambia nada.
const reemplazar = async (idOperario, ventanas) => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM horario_operario WHERE id_operario = $1;', [idOperario]);

    for (const v of ventanas) {
      await client.query(
        `INSERT INTO horario_operario (id_operario, dia_semana, hora_inicio, hora_fin)
         VALUES ($1, $2, $3, $4);`,
        [idOperario, v.diaSemana, v.horaInicio, v.horaFin],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return listarPorOperario(idOperario);
};

// CP-E2E-04: ¿el instante `ts` cae dentro de alguna ventana laboral del
// operario? Se evalúa el día ISO (1=lunes..7=domingo) y la hora local en la
// zona de referencia.
const estaDentroDeHorario = async (idOperario, ts = new Date()) => {
  const res = await db.query(
    `SELECT 1
     FROM horario_operario
     WHERE id_operario = $1
       AND dia_semana = EXTRACT(ISODOW FROM ($2::timestamptz AT TIME ZONE $3))::int
       AND ($2::timestamptz AT TIME ZONE $3)::time BETWEEN hora_inicio AND hora_fin
     LIMIT 1;`,
    [idOperario, ts, TIMEZONE],
  );
  return res.rowCount > 0;
};

module.exports = {
  TIMEZONE,
  listarPorOperario,
  reemplazar,
  estaDentroDeHorario,
};
