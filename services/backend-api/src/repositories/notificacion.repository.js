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

const existeTablaNotificacion = async () => {
  const res = await db.query(`SELECT to_regclass('public.notificacion') AS existe;`);
  return Boolean(res.rows[0]?.existe);
};

const tieneColumna = async (tabla, columna) => {
  const res = await db.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1;
    `,
    [tabla, columna],
  );
  return res.rowCount > 0;
};

// H0015: panel operativo del supervisor, con el detalle de la condición
// (tipo de alerta + trabajador) resuelto igual que la bandeja de H0013.
const listar = async ({ soloNoLeidas = false } = {}) => {
  const existe = await existeTablaNotificacion();
  if (!existe) {
    return [];
  }

  try {
    const queryExacta = `
      SELECT
        n.id,
        n.id_alerta,
        n.fecha_envio,
        n.leida,
        a.estado AS estado_alerta,
        ta.nombre,
        ta.descripcion,
        o.nombre AS operario_nombre,
        o.apellido AS operario_apellido,
        o.area AS operario_area
      FROM notificacion n
      JOIN alerta a ON n.id_alerta = a.id
      JOIN tipo_alerta ta ON a.id_tipo_alerta = ta.id
      JOIN medicion m ON a.id_medicion = m.id
      JOIN operario o ON m.id_trabajador = o.id
      WHERE ($1::boolean IS FALSE OR n.leida = FALSE)
      ORDER BY n.fecha_envio DESC, n.id DESC;
    `;

    const queryFlexible = `
      SELECT
        n.id,
        n.id_alerta,
        COALESCE(n.fecha_envio, n.fecha_hora) AS fecha_envio,
        n.leida,
        n.fecha_lectura,
        a.estado AS estado_alerta,
        ta.nombre,
        NULL::text AS descripcion,
        ta.prioridad,
        o.nombre AS operario_nombre,
        o.apellido AS operario_apellido,
        o.area AS operario_area
      FROM notificacion n
      LEFT JOIN alerta a ON a.id = n.id_alerta
      LEFT JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
      LEFT JOIN medicion m ON m.id = a.id_medicion
      LEFT JOIN operario_seudonimo os ON os.id = m.id_seudonimo
      LEFT JOIN operario o ON o.id = os.id_operario
      WHERE ($1::boolean IS FALSE OR n.leida = FALSE)
      ORDER BY COALESCE(n.fecha_envio, n.fecha_hora) DESC, n.id DESC;
    `;

    try {
      const res = await db.query(queryExacta, [soloNoLeidas]);
      return res.rows;
    } catch (innerError) {
      const res = await db.query(queryFlexible, [soloNoLeidas]);
      return res.rows;
    }
  } catch (error) {
    if (error.code === '42P01' || error.code === '42703') {
      return [];
    }
    throw error;
  }
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
