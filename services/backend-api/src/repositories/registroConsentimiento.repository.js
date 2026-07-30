const db = require('../config/database');

// registro_consentimiento es append-only (RF-16): sólo alta y consulta,
// sin update ni delete desde la aplicación.

const crear = async ({ idOperario, estado, versionPolitica, fechaHora }) => {
  const query = `
    INSERT INTO registro_consentimiento (id_operario, estado, version_politica, fecha_hora)
    VALUES ($1, $2, $3, COALESCE($4, now()))
    RETURNING *;
  `;
  const res = await db.query(query, [idOperario, estado, versionPolitica, fechaHora || null]);
  return res.rows[0];
};

// Estado vigente = registro más reciente del trabajador (o undefined si nunca
// registró consentimiento). Resuelto por índice (id_operario, fecha_hora).
const obtenerVigente = async (idOperario) => {
  const query = `
    SELECT * FROM registro_consentimiento
    WHERE id_operario = $1
    ORDER BY fecha_hora DESC, id DESC
    LIMIT 1;
  `;
  const res = await db.query(query, [idOperario]);
  return res.rows[0];
};

const listarPorTrabajador = async (idOperario) => {
  const res = await db.query(
    'SELECT * FROM registro_consentimiento WHERE id_operario = $1 ORDER BY fecha_hora DESC, id DESC;',
    [idOperario],
  );
  return res.rows;
};

module.exports = {
  crear,
  obtenerVigente,
  listarPorTrabajador,
};
