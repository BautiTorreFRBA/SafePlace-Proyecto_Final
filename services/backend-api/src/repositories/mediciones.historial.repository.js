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
      m.spo2
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

// P1/S1: la pantalla ya no muestra un flag "válido" por fila (medicion.estado
// nunca se escribe y toda fila persistida ya pasó el pipeline de RF-04/H0008).
// En su lugar se expone el resultado REAL del Servicio de Validación de Datos
// para el período: cuántos paquetes se aceptaron y cuántos se descartaron,
// desglosados por motivo, leídos de log_auditoria (operacion
// 'DESCARTE_VALIDACION', escrita por validacion-datos.service.auditarDescarte).
//
// El desglose no se filtra por empleado a propósito: el descarte se audita sin
// id_trabajador ni biodato (minimización, Ley 25.326), así que sólo puede
// informarse a nivel período + wearable.
const resumenValidacion = async ({ desde = null, hasta = null } = {}) => {
  const query = `
    WITH validas AS (
      SELECT COUNT(*)::int AS total
      FROM medicion m
      WHERE ($1::date IS NULL OR m.fecha_hora::date >= $1::date)
        AND ($2::date IS NULL OR m.fecha_hora::date <= $2::date)
    ),
    descartes AS (
      SELECT
        COALESCE(NULLIF(la.detalle::jsonb ->> 'motivo', ''), 'DESCONOCIDO') AS motivo,
        COUNT(*)::int AS total
      FROM log_auditoria la
      WHERE la.operacion = 'DESCARTE_VALIDACION'
        AND la.tabla_afectada = 'medicion'
        AND ($1::date IS NULL OR la.fecha_hora::date >= $1::date)
        AND ($2::date IS NULL OR la.fecha_hora::date <= $2::date)
      GROUP BY 1
    ),
    errores AS (
      SELECT COUNT(*)::int AS total
      FROM log_auditoria la
      WHERE la.operacion = 'ERROR_ALMACENAMIENTO'
        AND la.tabla_afectada = 'medicion'
        AND ($1::date IS NULL OR la.fecha_hora::date >= $1::date)
        AND ($2::date IS NULL OR la.fecha_hora::date <= $2::date)
    )
    SELECT
      (SELECT total FROM validas)  AS validas,
      (SELECT total FROM errores)  AS errores_almacenamiento,
      COALESCE((SELECT SUM(total) FROM descartes), 0)::int AS descartes_total,
      COALESCE(
        (SELECT jsonb_object_agg(motivo, total) FROM descartes),
        '{}'::jsonb
      ) AS descartes_por_motivo;
  `;

  const res = await db.query(query, [desde, hasta]);
  const row = res.rows[0] || {};
  return {
    validas: Number(row.validas || 0),
    descartesTotal: Number(row.descartes_total || 0),
    erroresAlmacenamiento: Number(row.errores_almacenamiento || 0),
    descartesPorMotivo: row.descartes_por_motivo || {},
  };
};

module.exports = {
  listarHistorialMediciones,
  resumenValidacion,
};
