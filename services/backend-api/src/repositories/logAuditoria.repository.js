const db = require('../config/database');

const registrar = async ({ idUsuario, tablaAfectada, operacion, ipOrigen, detalle }) => {
  const query = `
    INSERT INTO log_auditoria (
      id_usuario,
      tabla_afectada,
      operacion,
      ip_origen,
      detalle,
      fecha_hora
    )
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()))
    RETURNING *;
  `;

  const result = await db.query(query, [
    idUsuario || null,
    tablaAfectada,
    operacion,
    ipOrigen || null,
    detalle,
    null,
  ]);

  return result.rows[0];
};

const listar = async ({ limit = 100, offset = 0 } = {}) => {
  const query = `
    SELECT *
    FROM log_auditoria
    ORDER BY fecha_hora DESC, id DESC
    LIMIT $1 OFFSET $2;
  `;

  const result = await db.query(query, [limit, offset]);
  return result.rows;
};

module.exports = {
  registrar,
  listar,
};
