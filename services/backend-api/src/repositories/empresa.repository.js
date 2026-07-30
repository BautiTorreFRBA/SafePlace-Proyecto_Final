const db = require('../config/database');

const crear = async ({ nombre, cuit, direccion }) => {
  const query = `
    INSERT INTO empresa (nombre, cuit, direccion)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  const result = await db.query(query, [nombre, cuit, direccion || null]);
  return result.rows[0];
};

module.exports = {
  crear,
};
