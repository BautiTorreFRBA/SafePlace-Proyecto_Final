const db = require('../config/database');

// ON CONFLICT DO NOTHING sobre el índice único (id_dispositivo, fecha_hora):
// si dos paquetes idénticos llegan en paralelo y ambos pasan la validación de
// duplicados, el segundo INSERT devuelve undefined en lugar de duplicar la
// fila (H0008: "No se aceptan registros duplicados").
const crear = async (data) => {
  const {
    idSeudonimo,
    idDispositivo,
    frecuenciaCardiaca,
    actividad,
    temperaturaCorporal,
    spo2,
    fechaHora,
  } = data;

  const query = `
    INSERT INTO medicion (
      id_seudonimo, id_dispositivo, fecha_hora,
      frecuencia_cardiaca, actividad,
      temperatura_corporal, spo2
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id_dispositivo, fecha_hora) DO NOTHING
    RETURNING *;
  `;

  const values = [
    idSeudonimo,
    idDispositivo,
    fechaHora || new Date(),
    frecuenciaCardiaca,
    actividad,
    temperaturaCorporal,
    spo2,
  ];

  const res = await db.query(query, values);
  return res.rows[0];
};

// Chequeo de duplicados de la etapa de validación (RF-04/H0008); resuelto
// por el índice único, sin escaneo de tabla (RNF-01).
const existeDuplicado = async (idDispositivo, fechaHora) => {
  const res = await db.query(
    'SELECT 1 FROM medicion WHERE id_dispositivo = $1 AND fecha_hora = $2 LIMIT 1;',
    [idDispositivo, fechaHora],
  );
  return res.rowCount > 0;
};

const obtenerPorId = async (id) => {
  const res = await db.query('SELECT * FROM medicion WHERE id = $1;', [id]);
  return res.rows[0];
};

// H0020: la tabla medicion sólo conoce el seudónimo, nunca al operario
// directamente — resolver "mediciones de tal trabajador" contra su
// identidad civil es responsabilidad de la capa de servicio (ver
// mediciones.service.listarMedicionesDeTrabajador).
const listarPorSeudonimo = async (idSeudonimo, { desde, hasta, limit = 100, offset = 0 } = {}) => {
  const query = `
    SELECT * FROM medicion
    WHERE id_seudonimo = $1
      AND ($2::timestamptz IS NULL OR fecha_hora >= $2)
      AND ($3::timestamptz IS NULL OR fecha_hora <= $3)
    ORDER BY fecha_hora DESC
    LIMIT $4 OFFSET $5;
  `;
  const res = await db.query(query, [idSeudonimo, desde || null, hasta || null, limit, offset]);
  return res.rows;
};

const listar = async ({ limit = 100, offset = 0 } = {}) => {
  const query = `
    SELECT * FROM medicion
    ORDER BY fecha_hora DESC
    LIMIT $1 OFFSET $2;
  `;
  const res = await db.query(query, [limit, offset]);
  return res.rows;
};

// Motor de Reglas (H0010/H0012): mediciones del mismo seudónimo en los
// últimos `minutos`, de más antigua a más nueva — la ventana que evalúan
// las reglas de condición sostenida (fatiga, inactividad prolongada).
//
// El límite real es `minutos + 1`, no `minutos`: la regla necesita
// comprobar que la medición más antigua de la ventana tiene *al menos*
// `minutos` de antigüedad (para saber que la condición se sostuvo todo ese
// tiempo). Si el corte SQL fuera exactamente `minutos`, ninguna fila
// devuelta podría tener esa antigüedad completa — el propio filtro la habría
// excluido. El minuto extra de margen es lo que le da al motor de reglas una
// fila real contra la cual verificarlo.
const listarVentanaReciente = async (idSeudonimo, minutos) => {
  const query = `
    SELECT * FROM medicion
    WHERE id_seudonimo = $1
      AND fecha_hora >= now() - (($2 + 1) || ' minutes')::interval
    ORDER BY fecha_hora ASC;
  `;
  const res = await db.query(query, [idSeudonimo, minutos]);
  return res.rows;
};

// CP-E2E-04: detección de "wearable congelado". Un wearable fuera de la
// muñeca suele seguir emitiendo la última pulsación medida; el hub la
// reenvía cada REPORT_INTERVAL. N lecturas seguidas con EXACTAMENTE la
// misma FC son biológicamente inverosímiles (la variabilidad latido a
// latido siempre mueve el entero) — se tratan como desconexión.
// Devuelve las últimas `limite` FC del dispositivo, de más nueva a más vieja.
const ultimasFrecuencias = async (idDispositivo, limite) => {
  const query = `
    SELECT frecuencia_cardiaca, fecha_hora
    FROM medicion
    WHERE id_dispositivo = $1
    ORDER BY fecha_hora DESC, id DESC
    LIMIT $2;
  `;
  const res = await db.query(query, [idDispositivo, limite]);
  return res.rows;
};

module.exports = {
  crear,
  existeDuplicado,
  obtenerPorId,
  listarPorSeudonimo,
  listar,
  listarVentanaReciente,
  ultimasFrecuencias,
};
