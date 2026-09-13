const db = require('../config/database');

// Zona horaria de referencia para interpretar el horario laboral (mismo
// criterio que dashboard.repository). Configurable por si se opera en otra.
const TIMEZONE = process.env.HORARIO_TIMEZONE || 'America/Argentina/Buenos_Aires';

// `fecha::text` evita que node-pg devuelva un objeto Date para la columna
// `date` — serializado a ISO en UTC podría correrse un día según la zona
// horaria del proceso. Como texto ("YYYY-MM-DD") no hay ambigüedad posible.
const listarPorOperario = async (idOperario) => {
  const res = await db.query(
    `SELECT ho.id, ho.id_operario, ho.dia_semana, ho.hora_inicio, ho.hora_fin,
            ho.id_trabajo, ho.fecha::text AS fecha, t.nombre AS trabajo_nombre
     FROM horario_operario ho
     LEFT JOIN trabajo t ON t.id = ho.id_trabajo
     WHERE ho.id_operario = $1
     ORDER BY ho.fecha NULLS FIRST, ho.dia_semana, ho.hora_inicio;`,
    [idOperario],
  );
  return res.rows;
};

const listarExcepcionesPorOperario = async (idOperario) => {
  const res = await db.query(
    `SELECT ho.id, ho.id_operario, ho.dia_semana, ho.hora_inicio, ho.hora_fin,
            ho.id_trabajo, ho.fecha::text AS fecha, t.nombre AS trabajo_nombre
     FROM horario_operario ho
     LEFT JOIN trabajo t ON t.id = ho.id_trabajo
     WHERE ho.id_operario = $1 AND ho.fecha IS NOT NULL
     ORDER BY ho.fecha, ho.hora_inicio;`,
    [idOperario],
  );
  return res.rows;
};

// Reemplaza el horario RECURRENTE del operario por el conjunto de ventanas
// recibido (una o más por día, ya validadas sin superposición horaria).
// Nunca toca las excepciones puntuales por fecha (fecha IS NOT NULL) — esas
// se gestionan aparte con agregarExcepcion/eliminarExcepcion. Transaccional:
// o queda el set nuevo entero, o no cambia nada.
const reemplazar = async (idOperario, ventanas) => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM horario_operario WHERE id_operario = $1 AND fecha IS NULL;', [idOperario]);

    for (const v of ventanas) {
      await client.query(
        `INSERT INTO horario_operario (id_operario, dia_semana, hora_inicio, hora_fin, id_trabajo, fecha)
         VALUES ($1, $2, $3, $4, $5, NULL);`,
        [idOperario, v.diaSemana, v.horaInicio, v.horaFin, v.idTrabajo || null],
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

// Excepción puntual: horario válido sólo para `fecha`, con prioridad sobre
// lo recurrente de ese día de la semana. dia_semana se completa a partir de
// `fecha` únicamente para orden/consistencia de datos.
const agregarExcepcion = async (idOperario, { fecha, horaInicio, horaFin, idTrabajo }) => {
  const res = await db.query(
    `INSERT INTO horario_operario (id_operario, dia_semana, hora_inicio, hora_fin, id_trabajo, fecha)
     VALUES ($1, EXTRACT(ISODOW FROM $2::date)::int, $3, $4, $5, $2::date)
     RETURNING id, id_operario, dia_semana, hora_inicio, hora_fin, id_trabajo, fecha::text AS fecha;`,
    [idOperario, fecha, horaInicio, horaFin, idTrabajo || null],
  );
  return res.rows[0];
};

const eliminarExcepcion = async (idOperario, idExcepcion) => {
  const res = await db.query(
    `DELETE FROM horario_operario
     WHERE id = $1 AND id_operario = $2 AND fecha IS NOT NULL
     RETURNING id;`,
    [idExcepcion, idOperario],
  );
  return res.rowCount > 0;
};

// CP-E2E-04: ¿el instante `ts` cae dentro de alguna ventana laboral del
// operario? Se evalúa el día ISO (1=lunes..7=domingo) y la hora local en la
// zona de referencia. Una excepción puntual para la fecha de `ts` tiene
// prioridad sobre la ventana recurrente de ese día de la semana. Devuelve
// la ventana completa (con id_trabajo, para resolver el umbral efectivo) o
// undefined si no hay ninguna vigente.
const obtenerVentanaVigente = async (idOperario, ts = new Date()) => {
  const res = await db.query(
    `SELECT id, id_operario, dia_semana, hora_inicio, hora_fin, id_trabajo, fecha
     FROM horario_operario
     WHERE id_operario = $1
       AND (
         fecha = ($2::timestamptz AT TIME ZONE $3)::date
         OR (fecha IS NULL AND dia_semana = EXTRACT(ISODOW FROM ($2::timestamptz AT TIME ZONE $3))::int)
       )
       AND ($2::timestamptz AT TIME ZONE $3)::time BETWEEN hora_inicio AND hora_fin
     ORDER BY fecha NULLS LAST
     LIMIT 1;`,
    [idOperario, ts, TIMEZONE],
  );
  return res.rows[0];
};

module.exports = {
  TIMEZONE,
  listarPorOperario,
  listarExcepcionesPorOperario,
  reemplazar,
  agregarExcepcion,
  eliminarExcepcion,
  obtenerVentanaVigente,
};
