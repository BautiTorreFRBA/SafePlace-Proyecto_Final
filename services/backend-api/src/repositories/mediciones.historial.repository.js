const db = require('../config/database');

const listarHistorialMediciones = async ({
  desde = null,
  hasta = null,
  empleado = null,
  limit = 200,
  offset = 0,
} = {}) => {
  // H0020: reidentificación vía operario_seudonimo (tabla protegida); esta
  // consulta ya está detrás de auth + authorize(['supervisor']).
  const query = `
    SELECT
      m.id,
      o.id AS id_trabajador,
      o.nombre AS operario_nombre,
      o.apellido AS operario_apellido,
      m.id_dispositivo,
      m.fecha_hora,
      m.frecuencia_cardiaca,
      m.actividad,
      m.temperatura_corporal,
      m.spo2,
      m.estado
    FROM medicion m
    LEFT JOIN operario_seudonimo os ON os.id = m.id_seudonimo
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE ($1::date IS NULL OR m.fecha_hora::date >= $1::date)
      AND ($2::date IS NULL OR m.fecha_hora::date <= $2::date)
      AND (
        $3::text IS NULL
        OR CONCAT_WS(' ', o.nombre, o.apellido) ILIKE '%' || $3 || '%'
      )
    ORDER BY m.fecha_hora DESC, m.id DESC
    LIMIT $4 OFFSET $5;
  `;

  const res = await db.query(query, [desde, hasta, empleado, limit, offset]);
  return res.rows;
};

module.exports = {
  listarHistorialMediciones,
};
