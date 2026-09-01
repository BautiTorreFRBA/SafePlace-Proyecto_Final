const db = require('../config/database');
const TIMEZONE = 'America/Argentina/Buenos_Aires';
const SUMMARY_TIMEZONE = 'UTC';

const listarEmpresas = async () => {
  const res = await db.query(`
    SELECT id, nombre
    FROM empresa
    ORDER BY nombre, id;
  `);
  return res.rows;
};

const listarEmpleados = async () => {
  const query = `
    SELECT
      o.id,
      o.id_empresa,
      o.legajo,
      o.nombre,
      o.apellido,
      o.area AS depto,
      o.email,
      'Operario' AS rol,
      o.estado AS estado,
      o.alta AS alta
    FROM operario o
    ORDER BY o.apellido, o.nombre, o.id;
  `;
  const res = await db.query(query);
  return res.rows;
};

const generarLegajoEmpleado = async (client) => {
  const query = `
    SELECT COALESCE(MAX(
      NULLIF(regexp_replace(legajo, '\\D', '', 'g'), '')::int
    ), 0) + 1 AS siguiente
    FROM operario
    WHERE legajo ~ '\\d';
  `;

  const res = await client.query(query);
  const siguiente = Number(res.rows[0]?.siguiente || 1);
  return `EMP-${String(siguiente).padStart(3, '0')}`;
};

const crearEmpleado = async ({ nombre, apellido, area, email, idEmpresa }) => {
  const nombreLimpio = String(nombre || '').trim();
  const apellidoLimpio = String(apellido || '').trim();
  const areaLimpia = String(area || '').trim();

  if (!nombreLimpio || !apellidoLimpio || !areaLimpia || !idEmpresa) {
    throw new Error('Faltan campos obligatorios para crear el empleado.');
  }
  if (email && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    throw new Error('El email del empleado no es válido.');
  }

  try {
    const client = await db.getPool().connect();
    let legajoLimpio;
    try {
      legajoLimpio = await generarLegajoEmpleado(client);
    } finally {
      client.release();
    }
    const query = `
    INSERT INTO operario (id_empresa, legajo, nombre, apellido, area, email, alta, estado)
      VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NOW(), TRUE)
      RETURNING id, id_empresa, legajo, nombre, apellido, area, email, estado;
    `;

    const res = await db.query(query, [idEmpresa, legajoLimpio, nombreLimpio, apellidoLimpio, areaLimpia, String(email || '').trim().toLowerCase()]);
    return res.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const dup = new Error('Ya existe un empleado con ese legajo.');
      dup.status = 409;
      dup.motivo = 'EMPLEADO_DUPLICADO';
      throw dup;
    }

    if (error.code === '23503') {
      const fk = new Error('No se pudo crear el empleado porque la empresa no existe o no es válida.');
      fk.status = 409;
      fk.motivo = 'FK_INVALIDA';
      throw fk;
    }

    throw error;
  }
};

const actualizarEmpleado = async (id, { nombre, apellido, area, email, idEmpresa }) => {
  const nombreLimpio = String(nombre || '').trim();
  const apellidoLimpio = String(apellido || '').trim();
  const areaLimpia = String(area || '').trim();

  if (!nombreLimpio || !apellidoLimpio || !areaLimpia || !idEmpresa) {
    throw new Error('Faltan campos obligatorios para actualizar el empleado.');
  }
  if (email && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    throw new Error('El email del empleado no es válido.');
  }

  try {
    const query = `
      UPDATE operario
      SET id_empresa = $2,
          nombre = $3,
          apellido = $4,
          area = $5,
          email = NULLIF($6, '')
      WHERE id = $1
      RETURNING id, id_empresa, legajo, nombre, apellido, area, email;
    `;

    const res = await db.query(query, [id, idEmpresa, nombreLimpio, apellidoLimpio, areaLimpia, String(email || '').trim().toLowerCase()]);
    return res.rows[0] || null;
  } catch (error) {
    if (error.code === '23505') {
      const dup = new Error('Ya existe un empleado con ese legajo.');
      dup.status = 409;
      dup.motivo = 'EMPLEADO_DUPLICADO';
      throw dup;
    }

    if (error.code === '23503') {
      const fk = new Error('No se pudo actualizar el empleado porque la empresa no existe o no es valida.');
      fk.status = 409;
      fk.motivo = 'FK_INVALIDA';
      throw fk;
    }

    throw error;
  }
};

// H0026: "el sistema registra fecha de desactivación" / "registra quién
// realizó la baja" — idUsuarioBaja es el usuario autenticado que ejecuta el PATCH.
const desactivarEmpleado = async (id, idUsuarioBaja) => {
  const query = `
    UPDATE operario
    SET estado = FALSE,
        fecha_baja = now(),
        dado_de_baja_por = $2
    WHERE id = $1
    RETURNING id, id_empresa, legajo, nombre, apellido, area, estado, alta, fecha_baja, dado_de_baja_por;
  `;

  const res = await db.query(query, [id, idUsuarioBaja || null]);
  return res.rows[0] || null;
};

const listarUsuarios = async () => {
  const query = `
    SELECT
      u.id,
      u.nombre,
      u.apellido,
      u.email,
      u.id_empresa,
      e.nombre AS empresa_nombre,
      u.activo,
      COALESCE(
        jsonb_agg(to_jsonb(r) ORDER BY ur.id_rol) FILTER (WHERE r.id IS NOT NULL),
        '[]'::jsonb
      ) AS roles
    FROM usuario u
    LEFT JOIN empresa e ON e.id = u.id_empresa
    LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id
    LEFT JOIN rol r ON r.id = ur.id_rol
    GROUP BY
      u.id,
      u.nombre,
      u.apellido,
      u.email,
      u.id_empresa,
      e.nombre,
      u.activo
    ORDER BY u.apellido, u.nombre, u.id;
  `;
  const res = await db.query(query);
  return res.rows;
};

const listarMediciones = async ({ desde = null, hasta = null, limit = 100, offset = 0 } = {}) => {
  // H0020: medicion sólo guarda id_seudonimo; la identidad se recupera acá
  // vía operario_seudonimo (tabla protegida) porque esta consulta ya está
  // detrás de auth + authorize (usuario autorizado, criterio 3/4 de H0020).
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
    WHERE ($1::timestamptz IS NULL OR m.fecha_hora >= $1)
      AND ($2::timestamptz IS NULL OR m.fecha_hora <= $2)
    ORDER BY m.fecha_hora DESC
    LIMIT $3 OFFSET $4;
  `;
  const res = await db.query(query, [desde, hasta, limit, offset]);
  return res.rows;
};

// Monitoreo (H0013): una fila por operario con su medición más reciente.
// No sirve recortar una página de listarMediciones: si un operario concentra
// casi todas las lecturas, tapa al resto. Acá se resuelve en la DB con
// DISTINCT ON. Mismo criterio de reidentificación que listarMediciones.
const listarUltimaMedicionPorTrabajador = async () => {
  const query = `
    SELECT DISTINCT ON (o.id)
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
    JOIN operario_seudonimo os ON os.id = m.id_seudonimo
    JOIN operario o ON o.id = os.id_operario
    ORDER BY o.id, m.fecha_hora DESC, m.id DESC;
  `;
  const res = await db.query(query);
  return res.rows;
};

const listarDispositivos = async () => {
  const query = `
    SELECT
      d.id,
      d.marca,
      d.modelo,
      d.estado,
      o.id AS operario_id,
      o.nombre AS operario_nombre,
      o.apellido AS operario_apellido,
      ad.fecha_desde,
      ad.fecha_hasta,
      hed.estado AS ultimo_estado,
      hed.fecha_hora AS ultima_sinc
    FROM dispositivo d
    LEFT JOIN LATERAL (
      SELECT *
      FROM asignacion_dispositivo ad
      WHERE ad.id_dispositivo = d.id
      ORDER BY ad.fecha_desde DESC, ad.id DESC
      LIMIT 1
    ) ad ON true
    LEFT JOIN operario o ON o.id = ad.id_trabajador
    LEFT JOIN LATERAL (
      SELECT *
      FROM historial_estado_dispositivo hed
      WHERE hed.id_dispositivo = d.id
      ORDER BY hed.fecha_hora DESC, hed.id DESC
      LIMIT 1
    ) hed ON true
    ORDER BY d.id;
  `;
  const res = await db.query(query);
  return res.rows;
};

const listarAlertas = async ({ desde = null, hasta = null } = {}) => {
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
    LEFT JOIN operario_seudonimo os ON os.id = COALESCE(m.id_seudonimo, a.id_seudonimo)
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE ($1::timestamptz IS NULL OR a.fecha_hora >= $1)
      AND ($2::timestamptz IS NULL OR a.fecha_hora <= $2)
    ORDER BY a.fecha_hora DESC, a.id DESC;
  `;
  const res = await db.query(query, [desde, hasta]);
  return res.rows;
};

const obtenerResumenSupervisor = async () => {
  const alertasPorDiaQuery = `
    WITH parametros AS (
      SELECT
        (timezone('${SUMMARY_TIMEZONE}', now())::date - 6) AS inicio,
        timezone('${SUMMARY_TIMEZONE}', now())::date AS fin
    )
    SELECT
      to_char(timezone('${SUMMARY_TIMEZONE}', a.fecha_hora)::date, 'YYYY-MM-DD') AS dia,
      UPPER(ta.nombre) AS tipo_alerta,
      COUNT(*)::int AS total
    FROM alerta a
    JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
    CROSS JOIN parametros p
    WHERE timezone('${SUMMARY_TIMEZONE}', a.fecha_hora)::date BETWEEN p.inicio AND p.fin
      AND UPPER(ta.nombre) IN ('FATIGA', 'SOBREESFUERZO', 'INACTIVIDAD_PROLONGADA')
    GROUP BY 1, 2
    ORDER BY 1, 2;
  `;

  // Baldes de 15 minutos a lo largo del día (96 slots, 0..1425 min). Los
  // baldes sin lecturas devuelven promedio NULL para que la línea muestre
  // los huecos en vez de interpolarlos. `minuto_inicio` = minutos desde la
  // medianoche UTC.
  const frecuenciaHoyQuery = `
    WITH parametros AS (
      SELECT
        date_trunc('day', timezone('UTC', now())) AS inicio_hoy,
        date_trunc('day', timezone('UTC', now())) + interval '1 day' AS fin_hoy
    )
    SELECT
      gs.minuto_inicio,
      ROUND(AVG(m.frecuencia_cardiaca)::numeric, 2) AS promedio
    FROM parametros p
    CROSS JOIN generate_series(0, 1425, 15) AS gs(minuto_inicio)
    LEFT JOIN medicion m
      ON timezone('UTC', m.fecha_hora) >= p.inicio_hoy + make_interval(mins => gs.minuto_inicio)
     AND timezone('UTC', m.fecha_hora) < LEAST(
       p.inicio_hoy + make_interval(mins => gs.minuto_inicio + 15),
       p.fin_hoy
     )
    GROUP BY gs.minuto_inicio
    ORDER BY gs.minuto_inicio;
  `;

  const [alertasPorDiaResult, frecuenciaHoyResult] = await Promise.all([
    db.query(alertasPorDiaQuery),
    db.query(frecuenciaHoyQuery),
  ]);

  return {
    alertasPorDia: alertasPorDiaResult.rows,
    frecuenciaPromedioHoy: frecuenciaHoyResult.rows,
  };
};
module.exports = {
  listarEmpresas,
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  desactivarEmpleado,
  listarUsuarios,
  listarMediciones,
  listarUltimaMedicionPorTrabajador,
  listarDispositivos,
  listarAlertas,
  obtenerResumenSupervisor,
};
