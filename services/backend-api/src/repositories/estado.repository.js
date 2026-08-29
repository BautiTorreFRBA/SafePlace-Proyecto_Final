const db = require('../config/database');

const listarTrabajadoresActivos = async () => {
  const query = `
    WITH ultima_asignacion AS (
      SELECT DISTINCT ON (ad.id_trabajador)
        ad.id_trabajador,
        ad.id_dispositivo,
        ad.fecha_desde AS monitoreo_desde
      FROM asignacion_dispositivo ad
      WHERE ad.fecha_desde <= now()
        AND (ad.fecha_hasta IS NULL OR ad.fecha_hasta >= now())
      ORDER BY ad.id_trabajador, ad.fecha_desde DESC, ad.id DESC
    ),
    ultima_medicion AS (
      SELECT DISTINCT ON (os.id_operario)
        os.id_operario,
        m.id AS id_medicion,
        m.fecha_hora,
        m.frecuencia_cardiaca,
        m.actividad,
        m.temperatura_corporal,
        m.spo2
      FROM medicion m
      JOIN operario_seudonimo os ON os.id = m.id_seudonimo
      ORDER BY os.id_operario, m.fecha_hora DESC, m.id DESC
    ),
    alerta_activa AS (
      SELECT DISTINCT ON (os.id_operario)
        os.id_operario,
        a.id AS id_alerta,
        a.estado AS estado_alerta,
        a.fecha_hora AS alerta_fecha_hora,
        ta.nombre AS tipo_alerta,
        ta.prioridad AS prioridad_alerta
      FROM alerta a
      JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
      -- Las alertas de desconexion (INACTIVIDAD_PROLONGADA) no tienen medicion:
      -- se anclan directo por a.id_seudonimo. LEFT JOIN + COALESCE para no
      -- descartarlas, igual que alerta.repository y dashboard.repository.
      LEFT JOIN medicion m ON m.id = a.id_medicion
      JOIN operario_seudonimo os ON os.id = COALESCE(m.id_seudonimo, a.id_seudonimo)
      WHERE a.estado = 'Activa'
      ORDER BY os.id_operario, a.fecha_hora DESC, a.id DESC
    )
    SELECT
      o.id AS id_trabajador,
      o.legajo,
      o.nombre,
      o.apellido,
      o.area,
      ua.id_dispositivo,
      ua.monitoreo_desde,
      um.id_medicion,
      um.fecha_hora,
      um.frecuencia_cardiaca,
      um.actividad,
      um.temperatura_corporal,
      um.spo2,
      aa.id_alerta,
      aa.estado_alerta,
      aa.alerta_fecha_hora,
      aa.tipo_alerta,
      aa.prioridad_alerta,
      CASE
        WHEN um.id_medicion IS NULL THEN 'sin_datos'
        WHEN aa.id_alerta IS NOT NULL AND COALESCE(aa.prioridad_alerta, '') ILIKE '%crit%' THEN 'critico'
        WHEN aa.id_alerta IS NOT NULL THEN 'advertencia'
        WHEN um.fecha_hora < now() - interval '5 minutes' THEN 'desactualizado'
        ELSE 'normal'
      END AS estado_actual,
      CASE
        WHEN um.id_medicion IS NULL THEN 'Sin datos biométricos'
        WHEN aa.id_alerta IS NOT NULL THEN COALESCE(aa.tipo_alerta, 'Alerta activa')
        WHEN um.fecha_hora < now() - interval '5 minutes' THEN 'Sin actualización reciente'
        ELSE 'Estado normal'
      END AS estado_descripcion,
      EXTRACT(EPOCH FROM (now() - um.fecha_hora))::int AS segundos_desde_ultima_lectura
    FROM operario o
    INNER JOIN ultima_asignacion ua ON ua.id_trabajador = o.id
    LEFT JOIN ultima_medicion um ON um.id_operario = o.id
    LEFT JOIN alerta_activa aa ON aa.id_operario = o.id
    WHERE o.estado IS TRUE
    ORDER BY o.apellido, o.nombre, o.id;
  `;

  const res = await db.query(query);
  return res.rows;
};

module.exports = {
  listarTrabajadoresActivos,
};
