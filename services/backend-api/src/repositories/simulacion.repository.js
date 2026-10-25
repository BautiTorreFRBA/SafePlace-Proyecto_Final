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

const listarOperariosSimulados = async () => {
  const { rows } = await db.query(`
    SELECT o.id, o.nombre, o.apellido, o.legajo, o.area, o.turno,
           d.id AS dispositivo_id, d.marca, d.modelo, d.direccion_mac
    FROM dispositivo d
    JOIN LATERAL (
      SELECT id_trabajador
      FROM asignacion_dispositivo
      WHERE id_dispositivo = d.id
        AND fecha_desde <= now()
        AND (fecha_hasta IS NULL OR fecha_hasta >= now())
      ORDER BY fecha_desde DESC, id DESC
      LIMIT 1
    ) ad ON true
    JOIN operario o ON o.id = ad.id_trabajador
    WHERE d.direccion_mac ~* '^02:5E:ED:00:00:(0[1-9]|0A)$'
      AND o.estado IS TRUE
    ORDER BY d.direccion_mac;
  `);
  return rows;
};

module.exports = { obtenerEstado, actualizarEstado, listarOperariosSimulados };
