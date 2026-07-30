const db = require('../config/database');

// umbral_riesgo es append-only (H0023): sólo alta y consulta, igual que
// registro_consentimiento — "los cambios impactan únicamente en nuevas
// evaluaciones" se resuelve con versiones históricas, no con UPDATE.

const crear = async ({
  fcFatiga,
  minutosFatiga,
  fcSobreesfuerzo,
  actividadSobreesfuerzo,
  minutosInactividad,
  idUsuario,
}) => {
  const query = `
    INSERT INTO umbral_riesgo (
      fc_fatiga, minutos_fatiga, fc_sobreesfuerzo,
      actividad_sobreesfuerzo, minutos_inactividad, id_usuario
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const res = await db.query(query, [
    fcFatiga,
    minutosFatiga,
    fcSobreesfuerzo,
    actividadSobreesfuerzo,
    minutosInactividad,
    idUsuario || null,
  ]);
  return res.rows[0];
};

// Vigente = versión más reciente (o undefined si nunca se configuró nada).
const obtenerVigente = async () => {
  const res = await db.query(
    'SELECT * FROM umbral_riesgo ORDER BY fecha_hora DESC, id DESC LIMIT 1;',
  );
  return res.rows[0];
};

const listarHistorial = async () => {
  const res = await db.query(
    'SELECT * FROM umbral_riesgo ORDER BY fecha_hora DESC, id DESC;',
  );
  return res.rows;
};

module.exports = {
  crear,
  obtenerVigente,
  listarHistorial,
};
