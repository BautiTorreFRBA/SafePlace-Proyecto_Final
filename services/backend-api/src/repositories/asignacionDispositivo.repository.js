const db = require('../config/database');

const crear = async ({ idTrabajador, idDispositivo, fechaDesde, fechaHasta }) => {
  const query = `
    INSERT INTO asignacion_dispositivo (
      id_trabajador,
      id_dispositivo,
      fecha_desde,
      fecha_hasta
    )
    VALUES ($1, $2, COALESCE($3, now()), $4)
    RETURNING *;
  `;

  const result = await db.query(query, [
    idTrabajador,
    idDispositivo,
    fechaDesde || null,
    fechaHasta || null,
  ]);

  return result.rows[0];
};

const obtenerVigentePorDispositivo = async (idDispositivo) => {
  const query = `
    SELECT *
    FROM asignacion_dispositivo
    WHERE id_dispositivo = $1
      AND (fecha_hasta IS NULL OR fecha_hasta >= now())
    ORDER BY fecha_desde DESC, id DESC
    LIMIT 1;
  `;

  const result = await db.query(query, [idDispositivo]);
  return result.rows[0];
};

const listarPorDispositivo = async (idDispositivo) => {
  const query = `
    SELECT *
    FROM asignacion_dispositivo
    WHERE id_dispositivo = $1
    ORDER BY fecha_desde DESC, id DESC;
  `;

  const result = await db.query(query, [idDispositivo]);
  return result.rows;
};

module.exports = {
  crear,
  obtenerVigentePorDispositivo,
  listarPorDispositivo,
};
