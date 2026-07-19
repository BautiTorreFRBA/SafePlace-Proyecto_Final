const db = require('../config/database');

// ON CONFLICT DO NOTHING sobre el índice único (id_dispositivo, fecha_hora):
// si dos paquetes idénticos llegan en paralelo y ambos pasan la validación de
// duplicados, el segundo INSERT devuelve undefined en lugar de duplicar la
// fila (H0008: "No se aceptan registros duplicados").
const crear = async (data) => {
  const {
    idTrabajador,
    idDispositivo,
    frecuenciaCardiaca,
    nivelActividad,
    nivelInactividad,
    temperaturaCorporal,
    spo2,
    fechaHora,
  } = data;

  const query = `
    INSERT INTO medicion (
      id_trabajador, id_dispositivo, fecha_hora,
      frecuencia_cardiaca, nivel_actividad, nivel_inactividad,
      temperatura_corporal, spo2
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id_dispositivo, fecha_hora) DO NOTHING
    RETURNING *;
  `;

  const values = [
    idTrabajador,
    idDispositivo,
    fechaHora || new Date(),
    frecuenciaCardiaca,
    nivelActividad,
    nivelInactividad,
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

const listarPorTrabajador = async (idTrabajador, { desde, hasta, limit = 100, offset = 0 } = {}) => {
  const query = `
    SELECT * FROM medicion
    WHERE id_trabajador = $1
      AND ($2::timestamptz IS NULL OR fecha_hora >= $2)
      AND ($3::timestamptz IS NULL OR fecha_hora <= $3)
    ORDER BY fecha_hora DESC
    LIMIT $4 OFFSET $5;
  `;
  const res = await db.query(query, [idTrabajador, desde || null, hasta || null, limit, offset]);
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

module.exports = {
  crear,
  existeDuplicado,
  obtenerPorId,
  listarPorTrabajador,
  listar,
};
