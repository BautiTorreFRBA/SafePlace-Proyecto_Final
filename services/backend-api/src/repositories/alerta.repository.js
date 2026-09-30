const db = require('../config/database');

// La identidad del operario detrás de una alerta se resuelve por el seudónimo:
//  - alertas del motor de reglas: vía la medición que las originó
//    (medicion.id_seudonimo);
//  - alertas sin medición (inactividad prolongada / desconexión, CP-E2E-04):
//    directamente por alerta.id_seudonimo.
const JOIN_IDENTIDAD = `
  LEFT JOIN medicion m ON m.id = a.id_medicion
  LEFT JOIN operario_seudonimo os ON os.id = COALESCE(m.id_seudonimo, a.id_seudonimo)
  LEFT JOIN operario o ON o.id = os.id_operario
`;

const crear = async ({ idTipoAlerta, idMedicion = null, idSeudonimo = null }) => {
  const query = `
    INSERT INTO alerta (id_tipo_alerta, id_medicion, id_seudonimo)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const res = await db.query(query, [idTipoAlerta, idMedicion, idSeudonimo]);
  return res.rows[0];
};

// H0013: "no se generan alertas duplicadas para una misma condición activa"
// — misma condición = mismo tipo de riesgo, mismo operario (vía seudónimo,
// resuelto por la medición o por el anclaje directo), estado todavía Activa.
const existeActivaParaSeudonimoYTipo = async (idSeudonimo, idTipoAlerta) => {
  const query = `
    SELECT 1
    FROM alerta a
    LEFT JOIN medicion m ON m.id = a.id_medicion
    WHERE COALESCE(m.id_seudonimo, a.id_seudonimo) = $1
      AND a.id_tipo_alerta = $2
      AND a.estado = 'Activa'
    LIMIT 1;
  `;
  const res = await db.query(query, [idSeudonimo, idTipoAlerta]);
  return res.rowCount > 0;
};

// Nombres de tipo de las alertas del seudónimo (cualquier estado) generadas en
// los últimos `minutos`. Base de la escalada a EMERGENCIA.
const listarTiposEnVentana = async (idSeudonimo, minutos) => {
  const query = `
    SELECT ta.nombre
    FROM alerta a
    JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
    LEFT JOIN medicion m ON m.id = a.id_medicion
    WHERE COALESCE(m.id_seudonimo, a.id_seudonimo) = $1
      AND a.fecha_hora >= now() - make_interval(mins => $2::int);
  `;
  const res = await db.query(query, [idSeudonimo, minutos]);
  return res.rows.map((row) => row.nombre);
};

// Cierre automático (CP-E2E-04): cuando el wearable se reconecta, la condición
// de inactividad prolongada dejó de sostenerse — se cierran sus alertas Activas.
const cerrarActivasPorSeudonimoYTipo = async (idSeudonimo, idTipoAlerta) => {
  const query = `
    UPDATE alerta a
    SET estado = 'Cerrada'
    WHERE a.id_tipo_alerta = $2
      AND a.estado = 'Activa'
      AND COALESCE(
        (SELECT m.id_seudonimo FROM medicion m WHERE m.id = a.id_medicion),
        a.id_seudonimo
      ) = $1
    RETURNING a.*;
  `;
  const res = await db.query(query, [idSeudonimo, idTipoAlerta]);
  return res.rows;
};

// Pasa a `estado` (Atendida/Cerrada) las alertas Activas de ese seudónimo y tipo.
// Se usa al resolver una SUPER_EMERGENCIA, que arrastra a la EMERGENCIA abierta.
const actualizarEstadoActivasPorSeudonimoYTipo = async (idSeudonimo, idTipoAlerta, estado) => {
  const query = `
    UPDATE alerta a
    SET estado = $3
    WHERE a.id_tipo_alerta = $2
      AND a.estado = 'Activa'
      AND COALESCE(
        (SELECT m.id_seudonimo FROM medicion m WHERE m.id = a.id_medicion),
        a.id_seudonimo
      ) = $1
    RETURNING a.*;
  `;
  const res = await db.query(query, [idSeudonimo, idTipoAlerta, estado]);
  return res.rows;
};

const obtenerPorId = async (id) => {
  const res = await db.query('SELECT * FROM alerta WHERE id = $1;', [id]);
  return res.rows[0];
};

const actualizarEstado = async (id, estado) => {
  const res = await db.query(
    'UPDATE alerta SET estado = $2 WHERE id = $1 RETURNING *;',
    [id, estado],
  );
  return res.rows[0];
};

// Bandeja de alertas activas (H0013), con la identidad ya reidentificada
// (H0020) para mostrar nombre/apellido.
const listarActivas = async (usuario = {}) => {
  // Seguridad e Higiene ve todos los turnos: el filtro por turno queda desactivado (null).
  const turnoSeguridad = null;
  const query = `
    SELECT
      a.id,
      a.id_tipo_alerta,
      ta.nombre AS tipo_alerta,
      ta.prioridad,
      a.id_medicion,
      a.estado,
      a.fecha_hora,
      o.id AS id_trabajador,
      o.nombre AS operario_nombre,
      o.apellido AS operario_apellido
    FROM alerta a
    JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
    ${JOIN_IDENTIDAD}
    WHERE a.estado = 'Activa'
      AND ($1::text IS NULL OR o.turno = $1)
    ORDER BY a.fecha_hora DESC, a.id DESC;
  `;
  const res = await db.query(query, [turnoSeguridad]);
  return res.rows;
};

module.exports = {
  crear,
  existeActivaParaSeudonimoYTipo,
  listarTiposEnVentana,
  cerrarActivasPorSeudonimoYTipo,
  actualizarEstadoActivasPorSeudonimoYTipo,
  obtenerPorId,
  actualizarEstado,
  listarActivas,
};
