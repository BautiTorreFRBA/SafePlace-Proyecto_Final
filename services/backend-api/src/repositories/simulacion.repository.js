const db = require('../config/database');

const obtenerEstado = async () => {
  const { rows } = await db.query(
    'SELECT simulacion_activa FROM config_sistema ORDER BY id DESC LIMIT 1'
  );
  return rows[0] ?? { simulacion_activa: false };
};

const actualizarEstado = async (activa, idUsuario) => {
  const { rows } = await db.query(
    `UPDATE config_sistema
     SET simulacion_activa = $1, actualizado_por = $2, fecha_hora = NOW()
     WHERE id = (SELECT id FROM config_sistema ORDER BY id DESC LIMIT 1)
     RETURNING simulacion_activa`,
    [activa, idUsuario]
  );
  return rows[0];
};

module.exports = { obtenerEstado, actualizarEstado };
