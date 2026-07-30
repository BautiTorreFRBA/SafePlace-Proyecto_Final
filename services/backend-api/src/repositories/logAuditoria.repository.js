const db = require('../config/database');

const registrar = async ({
  idUsuario,
  tablaAfectada,
  idRegistro,
  operacion,
  ipOrigen,
  detalle,
}) => {
  const query = `
    INSERT INTO log_auditoria (
      id_usuario,
      tabla_afectada,
      id_registro,
      operacion,
      ip_origen,
      detalle,
      fecha_hora
    )
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
    RETURNING *;
  `;

  const result = await db.query(query, [
    idUsuario || null,
    tablaAfectada,
    idRegistro || null,
    operacion,
    ipOrigen || null,
    detalle,
    null,
  ]);

  return result.rows[0];
};

const CONDICIONES_FILTRO = `
  ($1::integer IS NULL OR la.id_usuario = $1)
  AND ($2::varchar IS NULL OR la.operacion = $2)
  AND ($3::timestamptz IS NULL OR la.fecha_hora >= $3)
  AND ($4::timestamptz IS NULL OR la.fecha_hora <= $4)
`;

const listar = async ({
  idUsuario, operacion, fechaDesde, fechaHasta, limit = 100, offset = 0,
} = {}) => {
  const query = `
    SELECT
      la.id,
      la.id_usuario,
      u.nombre AS usuario_nombre,
      u.apellido AS usuario_apellido,
      u.email AS usuario_email,
      la.tabla_afectada,
      la.id_registro,
      la.operacion,
      la.ip_origen,
      la.fecha_hora,
      la.detalle
    FROM log_auditoria la
    LEFT JOIN usuario u ON u.id = la.id_usuario
    WHERE ${CONDICIONES_FILTRO}
    ORDER BY la.fecha_hora DESC, la.id DESC
    LIMIT $5 OFFSET $6;
  `;

  const result = await db.query(query, [
    idUsuario || null,
    operacion || null,
    fechaDesde || null,
    fechaHasta || null,
    limit,
    offset,
  ]);
  return result.rows;
};

const contar = async ({ idUsuario, operacion, fechaDesde, fechaHasta } = {}) => {
  const query = `
    SELECT COUNT(*)::int AS total
    FROM log_auditoria la
    WHERE ${CONDICIONES_FILTRO};
  `;

  const result = await db.query(query, [
    idUsuario || null,
    operacion || null,
    fechaDesde || null,
    fechaHasta || null,
  ]);
  return result.rows[0].total;
};

module.exports = {
  registrar,
  listar,
  contar,
};
