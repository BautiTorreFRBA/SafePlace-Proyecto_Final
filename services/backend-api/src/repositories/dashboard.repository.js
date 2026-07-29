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
      COALESCE(rc.estado, false) AS activo,
      MIN(rc.fecha_hora) AS alta
    FROM operario o
    LEFT JOIN registro_consentimiento rc ON rc.id_operario = o.id
    GROUP BY o.id, o.id_empresa, o.legajo, o.nombre, o.apellido, o.area, rc.estado
    ORDER BY o.apellido, o.nombre, o.id;
  `;
  const res = await db.query(query);
  return res.rows;
};

const crearEmpleado = async ({ nombre, apellido, legajo, area, idEmpresa }) => {
  const nombreLimpio = String(nombre || '').trim();
  const apellidoLimpio = String(apellido || '').trim();
  const legajoLimpio = String(legajo || '').trim();
  const areaLimpia = String(area || '').trim();

  if (!nombreLimpio || !apellidoLimpio || !legajoLimpio || !areaLimpia || !idEmpresa) {
    throw new Error('Faltan campos obligatorios para crear el empleado.');
  }

  const existente = await db.query(
    'SELECT 1 FROM operario WHERE lower(legajo) = lower($1) LIMIT 1;',
    [legajoLimpio],
  );

  if (existente.rowCount > 0) {
    const error = new Error('Ya existe un empleado con ese legajo.');
    error.status = 409;
    error.motivo = 'EMPLEADO_DUPLICADO';
    throw error;
  }

  try {
    const query = `
      INSERT INTO operario (id_empresa, legajo, nombre, apellido, area)
      VALUES ($1, $2, $3, $4, $5)
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

const actualizarEmpleado = async (id, { nombre, apellido, legajo, area, idEmpresa }) => {
  const nombreLimpio = String(nombre || '').trim();
  const apellidoLimpio = String(apellido || '').trim();
  const legajoLimpio = String(legajo || '').trim();
  const areaLimpia = String(area || '').trim();

  if (!nombreLimpio || !apellidoLimpio || !legajoLimpio || !areaLimpia || !idEmpresa) {
    throw new Error('Faltan campos obligatorios para actualizar el empleado.');
  }

  const existente = await db.query(
    'SELECT 1 FROM operario WHERE lower(legajo) = lower($1) AND id <> $2 LIMIT 1;',
    [legajoLimpio, id],
  );

  if (existente.rowCount > 0) {
    const error = new Error('Ya existe un empleado con ese legajo.');
    error.status = 409;
    error.motivo = 'EMPLEADO_DUPLICADO';
    throw error;
  }

  try {
    const query = `
      UPDATE operario
      SET id_empresa = $2,
          legajo = $3,
          nombre = $4,
          apellido = $5,
          area = $6
      WHERE id = $1
      RETURNING id, id_empresa, legajo, nombre, apellido, area;
    `;

    const res = await db.query(query, [id, idEmpresa, legajoLimpio, nombreLimpio, apellidoLimpio, areaLimpia]);
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
  const query = `
    SELECT
      m.id,
      m.id_trabajador,
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
    LEFT JOIN operario o ON o.id = m.id_trabajador
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
    LEFT JOIN operario o ON o.id = m.id_trabajador
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
  listarUsuarios,
};
