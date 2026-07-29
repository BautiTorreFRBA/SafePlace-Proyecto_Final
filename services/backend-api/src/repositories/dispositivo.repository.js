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
    SELECT id, marca, modelo, estado
    FROM dispositivo
    WHERE id = $1;
  `;

  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

module.exports = {
  listarDisponibles,
  obtenerPorId,
};
