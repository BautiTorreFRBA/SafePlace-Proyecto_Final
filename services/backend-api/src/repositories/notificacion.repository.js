const db = require('../config/database');

const crear = async ({ idAlerta }) => {
  const query = `
    INSERT INTO notificacion (id_alerta)
    VALUES ($1)
    RETURNING *;
  `;
  const res = await db.query(query, [idAlerta]);
  return res.rows[0];
};

// H0015: panel operativo del supervisor, con el detalle de la condición
// (tipo de alerta + trabajador) resuelto igual que la bandeja de H0013.
const listar = async ({ soloNoLeidas = false } = {}) => {
  const query = `
    SELECT
      n.id,
      n.id_alerta,
      n.fecha_hora,
      n.leida,
      n.fecha_lectura,
      a.estado AS estado_alerta,
      ta.nombre AS tipo_alerta,
      ta.prioridad,
      o.nombre AS operario_nombre,
      o.apellido AS operario_apellido
    FROM notificacion n
    JOIN alerta a ON a.id = n.id_alerta
    JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
    LEFT JOIN medicion m ON m.id = a.id_medicion
    LEFT JOIN operario_seudonimo os ON os.id = COALESCE(m.id_seudonimo, a.id_seudonimo)
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE ($1::boolean IS FALSE OR n.leida = FALSE)
    ORDER BY n.fecha_hora DESC, n.id DESC;
  `;
  const res = await db.query(query, [soloNoLeidas]);
  return res.rows;
};

const marcarLeida = async (id) => {
  const query = `
    UPDATE notificacion
    SET leida = TRUE, fecha_lectura = now()
    WHERE id = $1
    RETURNING *;
  `;
  const res = await db.query(query, [id]);
  return res.rows[0];
};

module.exports = {
  crear,
  listar,
  marcarLeida,
};
