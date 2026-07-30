const db = require('../config/database');

const listarHistorialAlertas = async ({
  desde = null,
  tipo = null,
  empleado = null,
} = {}) => {
  const query = `
    SELECT
      a.id,
      a.id_tipo_alerta,
      ta.prioridad,
      ta.nombre AS tipo_alerta,
      a.id_medicion,
      a.fecha_hora,
      a.estado,
      o.nombre AS operario_nombre,
      o.apellido AS operario_apellido
    FROM alerta a
    LEFT JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
    LEFT JOIN medicion m ON m.id = a.id_medicion
    LEFT JOIN operario_seudonimo os ON os.id = m.id_seudonimo
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE ($1::date IS NULL OR a.fecha_hora::date >= $1::date)
      AND (
        $2::text IS NULL
        OR LOWER(ta.nombre) = LOWER($2)
      )
      AND (
        $3::text IS NULL
        OR CONCAT_WS(' ', o.nombre, o.apellido) ILIKE '%' || $3 || '%'
      )
    ORDER BY a.fecha_hora DESC, a.id DESC;
  `;

  const res = await db.query(query, [desde, tipo, empleado]);
  return res.rows;
};

module.exports = {
  listarHistorialAlertas,
};
