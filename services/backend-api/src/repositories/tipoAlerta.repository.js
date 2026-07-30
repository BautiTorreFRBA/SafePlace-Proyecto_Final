const db = require('../config/database');

// tipo_alerta es un catálogo fijo, sembrado por la migración
// (FATIGA, SOBREESFUERZO, INACTIVIDAD_PROLONGADA) — sin alta desde la app.

const obtenerPorNombre = async (nombre) => {
  const res = await db.query('SELECT * FROM tipo_alerta WHERE nombre = $1;', [nombre]);
  return res.rows[0];
};

const listar = async () => {
  const res = await db.query('SELECT * FROM tipo_alerta ORDER BY id;');
  return res.rows;
};

module.exports = {
  obtenerPorNombre,
  listar,
};
