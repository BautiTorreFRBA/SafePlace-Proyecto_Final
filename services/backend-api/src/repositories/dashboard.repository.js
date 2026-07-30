const db = require('../config/database');

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

const crearEmpleado = async ({ nombre, apellido, area, idEmpresa }) => {
  const nombreLimpio = String(nombre || '').trim();
  const apellidoLimpio = String(apellido || '').trim();
  const areaLimpia = String(area || '').trim();

  if (!nombreLimpio || !apellidoLimpio || !areaLimpia || !idEmpresa) {
    throw new Error('Faltan campos obligatorios para crear el empleado.');
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
      INSERT INTO operario (id_empresa, legajo, nombre, apellido, area, alta)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, id_empresa, legajo, nombre, apellido, area;
    `;

    const res = await db.query(query, [idEmpresa, legajoLimpio, nombreLimpio, apellidoLimpio, areaLimpia]);
    return res.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const dup = new Error('Ya existe un empleado con ese legajo.');
      dup.status = 409;
      dup.motivo = 'EMPLEADO_DUPLICADO';
      throw dup;
    }

    if (error.code === '23503') {
      const fk = new Error('No se pudo crear el empleado porque la empresa no existe o no es v�lida.');
      fk.status = 409;
      fk.motivo = 'FK_INVALIDA';
      throw fk;
    }

    throw error;
  }
};

const actualizarEmpleado = async (id, { nombre, apellido, area, idEmpresa }) => {
  const nombreLimpio = String(nombre || '').trim();
  const apellidoLimpio = String(apellido || '').trim();
  const areaLimpia = String(area || '').trim();

  if (!nombreLimpio || !apellidoLimpio || !areaLimpia || !idEmpresa) {
    throw new Error('Faltan campos obligatorios para actualizar el empleado.');
  }

  try {
    const query = `
      UPDATE operario
      SET id_empresa = $2,
          nombre = $3,
          apellido = $4,
          area = $5
      WHERE id = $1
      RETURNING id, id_empresa, legajo, nombre, apellido, area;
    `;

    const res = await db.query(query, [id, idEmpresa, nombreLimpio, apellidoLimpio, areaLimpia]);
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

const desactivarEmpleado = async (id) => {
  const query = `
    UPDATE operario
    SET estado = FALSE
    WHERE id = $1
    RETURNING id, id_empresa, legajo, nombre, apellido, area, estado, alta;
  `;

  const res = await db.query(query, [id]);
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
    LEFT JOIN operario_seudonimo os ON os.id = m.id_seudonimo
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE ($1::timestamptz IS NULL OR a.fecha_hora >= $1)
      AND ($2::timestamptz IS NULL OR a.fecha_hora <= $2)
    ORDER BY a.fecha_hora DESC, a.id DESC;
  `;
  const res = await db.query(query, [desde, hasta]);
  return res.rows;
};

module.exports = {
  listarEmpresas,
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  desactivarEmpleado,
  listarUsuarios,
  listarMediciones,
  listarDispositivos,
  listarAlertas,
};
