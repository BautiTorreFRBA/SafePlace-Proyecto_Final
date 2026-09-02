const db = require('../config/database');

// El hub reporta cada REPORT_INTERVAL segundos (5s por defecto, ver
// safeplace-hub/.env.example). Se usa para estimar cuántas lecturas se
// esperaban en un tramo y derivar la cobertura del enlace.
const INTERVALO_REPORTE_SEGUNDOS = 5;

// Fase 2 / S2: resoluciones de downsampling para la serie temporal del detalle.
const BUCKETS_VALIDOS = { '10s': 10, '1m': 60, '5m': 300 };

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

// Fase 2 / S2: una fila por empleado para el rango elegido, con agregados de
// FC, cobertura del enlace y conteo de alertas por tipo. Reemplaza el log
// crudo (una fila por pulsación) como vista maestro.
//
// - Reidentificación vía operario_seudonimo (H0020), igual que el resto.
// - Cobertura calculada sobre el TRAMO ACTIVO, minuto a minuto: se cuentan
//   los minutos distintos que tuvieron al menos una lectura y se comparan las
//   lecturas recibidas contra las esperadas en esos minutos
//   (60 / INTERVALO_REPORTE_SEGUNDOS por minuto). Mide dropout del enlace
//   mientras el wearable transmitía; las noches y fines de semana no cuentan
//   porque esos minutos no tienen lecturas. Un rango multi-día no lo distorsiona.
// - Se listan los operarios activos que tienen lecturas en el rango O una
//   asignación de wearable vigente (para que un wearable mudo aparezca como
//   "sin datos"). El filtro por nombre, si viene, manda sobre esa regla.
// - Alertas del período ancladas por seudónimo (vía medición o directo, como
//   alerta.repository) y agregadas por tipo.
const resumenPorEmpleado = async ({ desde = null, hasta = null, empleado = null } = {}) => {
  const query = `
    WITH agg AS (
      SELECT
        os.id_operario,
        COUNT(m.frecuencia_cardiaca)::int          AS lecturas,
        COUNT(DISTINCT date_trunc('minute', m.fecha_hora))
          FILTER (WHERE m.frecuencia_cardiaca IS NOT NULL)::int AS minutos_con_datos,
        ROUND(AVG(m.frecuencia_cardiaca))::int      AS fc_promedio,
        MIN(m.frecuencia_cardiaca)::int             AS fc_min,
        MAX(m.frecuencia_cardiaca)::int             AS fc_max,
        MIN(m.fecha_hora) FILTER (WHERE m.frecuencia_cardiaca IS NOT NULL) AS primera,
        MAX(m.fecha_hora) FILTER (WHERE m.frecuencia_cardiaca IS NOT NULL) AS ultima
      FROM medicion m
      JOIN operario_seudonimo os ON os.id = m.id_seudonimo
      WHERE ($1::date IS NULL OR m.fecha_hora::date >= $1::date)
        AND ($2::date IS NULL OR m.fecha_hora::date <= $2::date)
      GROUP BY os.id_operario
    ),
    alertas AS (
      SELECT
        COALESCE(m.id_seudonimo, a.id_seudonimo) AS id_seudonimo,
        ta.nombre                                AS tipo,
        COUNT(*)::int                            AS total
      FROM alerta a
      JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
      LEFT JOIN medicion m ON m.id = a.id_medicion
      WHERE ($1::date IS NULL OR a.fecha_hora::date >= $1::date)
        AND ($2::date IS NULL OR a.fecha_hora::date <= $2::date)
      GROUP BY 1, 2
    ),
    asignacion AS (
      SELECT DISTINCT ON (ad.id_trabajador)
        ad.id_trabajador, ad.id_dispositivo
      FROM asignacion_dispositivo ad
      ORDER BY ad.id_trabajador, ad.fecha_desde DESC, ad.id DESC
    )
    SELECT
      o.id            AS id_trabajador,
      o.legajo,
      o.nombre        AS operario_nombre,
      o.apellido      AS operario_apellido,
      o.area,
      asig.id_dispositivo,
      d.marca         AS dispositivo_marca,
      d.modelo        AS dispositivo_modelo,
      d.capacidades   AS dispositivo_capacidades,
      COALESCE(agg.lecturas, 0) AS lecturas,
      COALESCE(agg.minutos_con_datos, 0) AS minutos_con_datos,
      agg.fc_promedio,
      agg.fc_min,
      agg.fc_max,
      agg.primera,
      agg.ultima,
      EXTRACT(EPOCH FROM (now() - agg.ultima))::int AS segundos_desde_ultima,
      COALESCE(
        (SELECT jsonb_object_agg(al.tipo, al.total)
         FROM alertas al WHERE al.id_seudonimo = os.id),
        '{}'::jsonb
      ) AS alertas_por_tipo
    FROM operario o
    JOIN operario_seudonimo os ON os.id_operario = o.id
    LEFT JOIN agg  ON agg.id_operario = o.id
    LEFT JOIN asignacion asig ON asig.id_trabajador = o.id
    LEFT JOIN dispositivo d ON d.id = asig.id_dispositivo
    WHERE o.estado IS TRUE
      AND (
        $3::text IS NOT NULL
        OR agg.id_operario IS NOT NULL
        OR asig.id_dispositivo IS NOT NULL
      )
      AND (
        $3::text IS NULL
        OR CONCAT_WS(' ', o.nombre, o.apellido) ILIKE '%' || $3 || '%'
      )
    ORDER BY o.apellido, o.nombre, o.id;
  `;

  const res = await db.query(query, [desde, hasta, empleado]);

  const lecturasPorMinuto = 60 / INTERVALO_REPORTE_SEGUNDOS;

  return res.rows.map((r) => {
    const lecturas = Number(r.lecturas || 0);
    const minutosConDatos = Number(r.minutos_con_datos || 0);
    const esperadas = minutosConDatos * lecturasPorMinuto;
    const cobertura = esperadas > 0
      ? Math.min(100, Math.round((lecturas / esperadas) * 100))
      : null;

    return {
      idTrabajador: r.id_trabajador,
      legajo: r.legajo,
      nombre: r.operario_nombre,
      apellido: r.operario_apellido,
      area: r.area,
      dispositivo: r.id_dispositivo
        ? {
          id: r.id_dispositivo,
          marca: r.dispositivo_marca,
          modelo: r.dispositivo_modelo,
          capacidades: r.dispositivo_capacidades || null,
        }
        : null,
      lecturas,
      lecturasEsperadas: esperadas,
      coberturaPct: cobertura,
      fcPromedio: r.fc_promedio === null ? null : Number(r.fc_promedio),
      fcMin: r.fc_min === null ? null : Number(r.fc_min),
      fcMax: r.fc_max === null ? null : Number(r.fc_max),
      primera: lecturas > 0 ? r.primera : null,
      ultima: lecturas > 0 ? r.ultima : null,
      minutosMonitoreados: minutosConDatos,
      segundosDesdeUltima: lecturas > 0 && r.segundos_desde_ultima !== null
        ? Number(r.segundos_desde_ultima)
        : null,
      alertasPorTipo: r.alertas_por_tipo || {},
    };
  });
};

// Fase 2 / S2: serie temporal de FC de un empleado, submuestreada a baldes de
// `bucketSegundos` (el endpoint de detalle nunca devuelve el crudo completo).
// Cada balde trae promedio, mínimo, máximo y cantidad de lecturas. Los baldes
// sin datos simplemente no aparecen (el front dibuja el hueco).
const listarSerieMediciones = async ({
  desde = null,
  hasta = null,
  empleado = null,
  bucketSegundos = 60,
} = {}) => {
  const query = `
    SELECT
      to_timestamp(floor(extract(epoch FROM m.fecha_hora) / $4) * $4) AS bucket_ts,
      ROUND(AVG(m.frecuencia_cardiaca))::int AS fc_promedio,
      MIN(m.frecuencia_cardiaca)::int        AS fc_min,
      MAX(m.frecuencia_cardiaca)::int        AS fc_max,
      COUNT(m.frecuencia_cardiaca)::int      AS lecturas
    FROM medicion m
    LEFT JOIN operario_seudonimo os ON os.id = m.id_seudonimo
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE ($1::date IS NULL OR m.fecha_hora::date >= $1::date)
      AND ($2::date IS NULL OR m.fecha_hora::date <= $2::date)
      AND ($3::text IS NULL OR CONCAT_WS(' ', o.nombre, o.apellido) ILIKE '%' || $3 || '%')
      AND m.frecuencia_cardiaca IS NOT NULL
    GROUP BY 1
    ORDER BY 1;
  `;

  const res = await db.query(query, [desde, hasta, empleado, bucketSegundos]);
  return res.rows.map((r) => ({
    ts: r.bucket_ts,
    fcPromedio: Number(r.fc_promedio),
    fcMin: Number(r.fc_min),
    fcMax: Number(r.fc_max),
    lecturas: Number(r.lecturas),
  }));
};

module.exports = {
  listarHistorialMediciones,
  resumenValidacion,
  resumenPorEmpleado,
  listarSerieMediciones,
  BUCKETS_VALIDOS,
};
