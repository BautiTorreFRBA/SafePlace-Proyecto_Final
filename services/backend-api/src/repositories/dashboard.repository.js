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
      const fk = new Error('No se pudo crear el empleado porque la empresa no existe o no es válida.');
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

module.exports = {
  listarEmpresas,
  listarEmpleados,
  crearEmpleado,
  listarUsuarios,
};
