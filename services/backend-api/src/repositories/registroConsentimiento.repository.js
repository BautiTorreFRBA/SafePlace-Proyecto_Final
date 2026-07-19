const db = require('../config/database');

// registro_consentimiento es append-only (RF-16): sólo alta y consulta,
// sin update ni delete desde la aplicación.

const crear = async ({ idTrabajador, estado, versionPolitica, fechaHora }) => {
  const query = `
    INSERT INTO registro_consentimiento (id_trabajador, estado, version_politica, fecha_hora)
    VALUES ($1, $2, $3, COALESCE($4, now()))
    RETURNING *;
  `;
  const res = await db.query(query, [idTrabajador, estado, versionPolitica, fechaHora || null]);
  return res.rows[0];
};

// Estado vigente = registro más reciente del trabajador (o undefined si nunca
// registró consentimiento). Resuelto por índice (id_trabajador, fecha_hora).
const obtenerVigente = async (idTrabajador) => {
  const query = `
    SELECT * FROM registro_consentimiento
    WHERE id_trabajador = $1
    ORDER BY fecha_hora DESC, id DESC
    LIMIT 1;
  `;
  const res = await db.query(query, [idTrabajador]);
  return res.rows[0];
};

const listarPorTrabajador = async (idTrabajador) => {
  const res = await db.query(
    'SELECT * FROM registro_consentimiento WHERE id_trabajador = $1 ORDER BY fecha_hora DESC, id DESC;',
    [idTrabajador],
  );
  return res.rows;
};

module.exports = {
  crear,
  obtenerVigente,
  listarPorTrabajador,
};
