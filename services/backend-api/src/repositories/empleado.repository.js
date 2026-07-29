const db = require('../config/database');

const listar = async () => {
  const query = `
    SELECT
      o.id,
      o.nombre,
      o.apellido,
      o.area AS depto,
      'Operario' AS rol,
      COALESCE(rc.estado, false) AS activo,
      MIN(rc.fecha_hora) AS alta
    FROM operario o
    LEFT JOIN registro_consentimiento rc ON rc.id_operario = o.id
    GROUP BY o.id, o.nombre, o.apellido, o.area, rc.estado
    ORDER BY o.apellido, o.nombre, o.id;
  `;
  const res = await db.query(query);
  return res.rows;
};

const obtenerPorId = async (id) => {
  const res = await db.query(
    `
      SELECT
        o.id,
        o.nombre,
        o.apellido,
        o.area AS depto,
        COALESCE(rc.estado, false) AS activo
      FROM operario o
      LEFT JOIN registro_consentimiento rc ON rc.id_operario = o.id
      WHERE o.id = $1
      ORDER BY rc.fecha_hora DESC, rc.id DESC
      LIMIT 1;
    `,
    [id],
  );
  return res.rows[0] || null;
};

const actualizar = async (id, { nombre, apellido, depto }) => {
  const campos = [];
  const valores = [];
  let idx = 1;

  if (nombre !== undefined) {
    campos.push(`nombre = $${idx++}`);
    valores.push(nombre);
  }
  if (apellido !== undefined) {
    campos.push(`apellido = $${idx++}`);
    valores.push(apellido);
  }
  if (depto !== undefined) {
    campos.push(`area = $${idx++}`);
    valores.push(depto);
  }

  if (campos.length === 0) {
    return obtenerPorId(id);
  }

  valores.push(id);
  await db.query(`UPDATE operario SET ${campos.join(', ')} WHERE id = $${idx};`, valores);
  return obtenerPorId(id);
};

const desactivar = async (id) => {
  const res = await db.query(
    `
      INSERT INTO registro_consentimiento (id_operario, estado, fecha_hora)
      VALUES ($1, false, now())
      RETURNING *;
    `,
    [id],
  );
  return res.rows[0];
};

module.exports = {
  listar,
  obtenerPorId,
  actualizar,
  desactivar,
};
