const db = require('../config/database');

const listarDisponibles = async () => {
  const query = `
    SELECT id, marca, modelo, estado
    FROM dispositivo d
    WHERE NOT EXISTS (
      SELECT 1
      FROM asignacion_dispositivo ad
      WHERE ad.id_dispositivo = d.id
        AND (ad.fecha_hasta IS NULL OR ad.fecha_hasta >= now())
    )
    ORDER BY id;
  `;

  const result = await db.query(query);
  return result.rows;
};

const obtenerPorId = async (id) => {
  const query = `
    SELECT id, marca, modelo, estado, direccion_mac
    FROM dispositivo
    WHERE id = $1;
  `;

  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

const obtenerPorMac = async (direccionMac) => {
  const query = `
    SELECT id, marca, modelo, estado, direccion_mac
    FROM dispositivo
    WHERE direccion_mac = $1;
  `;

  const result = await db.query(query, [direccionMac]);
  return result.rows[0] || null;
};

const crear = async ({ marca, modelo, estado = true, direccionMac }) => {
  const query = `
    INSERT INTO dispositivo (marca, modelo, estado, direccion_mac)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const result = await db.query(query, [marca, modelo, estado, direccionMac || null]);
  return result.rows[0];
};

const actualizarMac = async (id, direccionMac) => {
  const query = `
    UPDATE dispositivo
    SET direccion_mac = $2
    WHERE id = $1
    RETURNING id, marca, modelo, estado, direccion_mac;
  `;

  const result = await db.query(query, [id, direccionMac]);
  return result.rows[0] || null;
};

module.exports = {
  listarDisponibles,
  obtenerPorId,
  obtenerPorMac,
  crear,
  actualizarMac,
};
