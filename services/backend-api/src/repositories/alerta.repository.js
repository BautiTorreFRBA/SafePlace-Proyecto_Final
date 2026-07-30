const db = require('../config/database');

const crear = async ({ idTipoAlerta, idMedicion }) => {
  const query = `
    INSERT INTO alerta (id_tipo_alerta, id_medicion)
    VALUES ($1, $2)
    RETURNING *;
  `;
  const res = await db.query(query, [idTipoAlerta, idMedicion]);
  return res.rows[0];
};

// H0013: "no se generan alertas duplicadas para una misma condición
// activa" — misma condición = mismo tipo de riesgo, mismo trabajador (vía
// seudónimo, no id_medicion puntual: mediciones distintas del mismo
// trabajador son la misma condición sostenida), estado todavía Activa.
const existeActivaParaSeudonimoYTipo = async (idSeudonimo, idTipoAlerta) => {
  const query = `
    SELECT 1
    FROM alerta a
    JOIN medicion m ON m.id = a.id_medicion
    WHERE m.id_seudonimo = $1
      AND a.id_tipo_alerta = $2
      AND a.estado = 'Activa'
    LIMIT 1;
  `;
  const res = await db.query(query, [idSeudonimo, idTipoAlerta]);
  return res.rowCount > 0;
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
// (H0020: alerta -> medicion -> operario_seudonimo -> operario) para mostrar
// nombre/apellido — misma reidentificación que dashboard.repository.listarAlertas.
const listarActivas = async () => {
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
    JOIN medicion m ON m.id = a.id_medicion
    LEFT JOIN operario_seudonimo os ON os.id = m.id_seudonimo
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE a.estado = 'Activa'
    ORDER BY a.fecha_hora DESC, a.id DESC;
  `;
  const res = await db.query(query);
  return res.rows;
};

module.exports = {
  crear,
  existeActivaParaSeudonimoYTipo,
  obtenerPorId,
  actualizarEstado,
  listarActivas,
};
