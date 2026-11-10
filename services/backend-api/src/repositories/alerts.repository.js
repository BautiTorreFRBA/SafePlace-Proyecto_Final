const db = require('../config/database');

// Seguridad e Higiene ve todos los turnos: el filtro por turno queda desactivado (null).
const turnoSeguridadActual = () => null;

const listarHistorialAlertas = async ({
  desde = null,
  hasta = null,
  tipo = null,
  empleado = null,
  area = null,
  turno = null,
  usuario = {},
} = {}) => {
  const turnoSeguridad = turnoSeguridadActual(usuario);
  const query = `
    SELECT
      a.id,
      a.id_tipo_alerta,
      ta.prioridad,
      ta.nombre AS tipo_alerta,
      a.id_medicion,
      a.fecha_hora,
      a.estado,
      o.id AS id_trabajador,
      o.nombre AS operario_nombre,
      o.apellido AS operario_apellido,
      o.area AS operario_area,
      o.turno AS operario_turno
    FROM alerta a
    LEFT JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
    LEFT JOIN medicion m ON m.id = a.id_medicion
    LEFT JOIN operario_seudonimo os ON os.id = COALESCE(m.id_seudonimo, a.id_seudonimo)
    LEFT JOIN operario o ON o.id = os.id_operario
      WHERE ($1::date IS NULL OR a.fecha_hora::date >= $1::date)
      AND ($2::date IS NULL OR a.fecha_hora::date <= $2::date)
      AND (
        $3::text IS NULL
        OR LOWER(ta.nombre) = LOWER($3)
      )
      AND (
        $4::text IS NULL
        OR CONCAT_WS(' ', o.nombre, o.apellido) ILIKE '%' || $4 || '%'
      )
      AND ($5::text IS NULL OR o.area = $5)
      AND ($6::text IS NULL OR o.turno = $6)
      AND ($7::text IS NULL OR o.turno = $7)
    ORDER BY a.fecha_hora DESC, a.id DESC;
  `;

  const res = await db.query(query, [desde, hasta, tipo, empleado, area, turno, turnoSeguridad]);
  return res.rows;
};

module.exports = {
  listarHistorialAlertas,
};
