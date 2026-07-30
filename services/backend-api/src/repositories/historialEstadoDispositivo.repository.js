const db = require('../config/database');

const registrarEstado = async (idDispositivo, estado) => {
  const query = `
    INSERT INTO historial_estado_dispositivo (id_dispositivo, estado)
    VALUES ($1, $2)
    RETURNING *;
  `;
  const res = await db.query(query, [idDispositivo, estado]);
  return res.rows[0];
};

const obtenerUltimoEstado = async (idDispositivo) => {
  const query = `
    SELECT * FROM historial_estado_dispositivo
    WHERE id_dispositivo = $1
    ORDER BY fecha_hora DESC, id DESC
    LIMIT 1;
  `;
  const res = await db.query(query, [idDispositivo]);
  return res.rows[0];
};

// H0006: dispositivos con asignación vigente cuya última actividad (la
// medición más reciente, o el inicio de la asignación si nunca mandó
// ninguna) tiene más de `minutos` de antigüedad, y cuyo último estado
// registrado todavía no es DESCONECTADO (para no insertar filas repetidas
// en cada corrida del chequeo periódico).
const listarDispositivosInactivos = async (minutos) => {
  const query = `
    SELECT d.id AS id_dispositivo
    FROM dispositivo d
    JOIN asignacion_dispositivo ad
      ON ad.id_dispositivo = d.id
      AND (ad.fecha_hasta IS NULL OR ad.fecha_hasta >= now())
    LEFT JOIN LATERAL (
      SELECT fecha_hora FROM medicion m
      WHERE m.id_dispositivo = d.id
      ORDER BY fecha_hora DESC LIMIT 1
    ) ultima_medicion ON true
    LEFT JOIN LATERAL (
      SELECT estado FROM historial_estado_dispositivo h
      WHERE h.id_dispositivo = d.id
      ORDER BY fecha_hora DESC LIMIT 1
    ) ultimo_estado ON true
    WHERE COALESCE(ultima_medicion.fecha_hora, ad.fecha_desde) < now() - ($1 || ' minutes')::interval
      AND COALESCE(ultimo_estado.estado, '') != 'DESCONECTADO';
  `;
  const res = await db.query(query, [minutos]);
  return res.rows;
};

// H0007: estado de conexión vigente de todos los dispositivos, para la
// pantalla de administración.
const listarEstadoActual = async () => {
  const query = `
    SELECT
      d.id, d.marca, d.modelo, d.estado AS activo, d.direccion_mac,
      h.estado AS estado_conexion, h.fecha_hora AS ultima_actividad
    FROM dispositivo d
    LEFT JOIN LATERAL (
      SELECT estado, fecha_hora FROM historial_estado_dispositivo hh
      WHERE hh.id_dispositivo = d.id
      ORDER BY fecha_hora DESC LIMIT 1
    ) h ON true
    ORDER BY d.id;
  `;
  const res = await db.query(query);
  return res.rows;
};

module.exports = {
  registrarEstado,
  obtenerUltimoEstado,
  listarDispositivosInactivos,
  listarEstadoActual,
};
