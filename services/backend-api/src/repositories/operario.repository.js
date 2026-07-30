const db = require('../config/database');

const listarActivos = async () => {
  const query = `
    SELECT id, id_empresa, legajo, nombre, apellido, area, estado, alta
    FROM operario
    WHERE estado IS TRUE
    ORDER BY apellido, nombre, id;
  `;

  const result = await db.query(query);
  return result.rows;
};

const obtenerPorId = async (id) => {
  const query = `
    SELECT id, id_empresa, legajo, nombre, apellido, area, estado, alta
    FROM operario
    WHERE id = $1;
  `;

  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

module.exports = {
  listarActivos,
  obtenerPorId,
};
