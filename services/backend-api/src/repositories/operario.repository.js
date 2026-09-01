const db = require('../config/database');

const listarActivos = async () => {
  const query = `
    SELECT id, id_empresa, legajo, nombre, apellido, area, email, estado, alta
    FROM operario
    WHERE estado IS TRUE
    ORDER BY apellido, nombre, id;
  `;

  const result = await db.query(query);
  return result.rows;
};

const obtenerPorId = async (id) => {
  const query = `
    SELECT id, id_empresa, legajo, nombre, apellido, area, email, estado, alta
    FROM operario
    WHERE id = $1;
  `;

  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

const crear = async ({
  idEmpresa, legajo, nombre, apellido, area, estado = true, alta,
}) => {
  const query = `
    INSERT INTO operario (id_empresa, legajo, nombre, apellido, area, estado, alta)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const result = await db.query(query, [
    idEmpresa, legajo, nombre, apellido, area || null, estado, alta || null,
  ]);
  return result.rows[0];
};

module.exports = {
  listarActivos,
  obtenerPorId,
  crear,
};
