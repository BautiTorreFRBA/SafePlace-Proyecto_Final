const db = require('../config/database');

// umbral_operario ("Configuración particular") es estado actual: una fila por
// operario, editada in-place. Ver migración 20260925000001.

const SELECT_CON_OPERARIO = `
  SELECT
    uo.id,
    uo.id_operario,
    uo.fc_fatiga,
    uo.fc_sobreesfuerzo,
    uo.actualizado_en,
    o.nombre AS operario_nombre,
    o.apellido AS operario_apellido,
    o.legajo AS operario_legajo
  FROM umbral_operario uo
  JOIN operario o ON o.id = uo.id_operario
`;

const listar = async () => {
  const res = await db.query(`${SELECT_CON_OPERARIO} ORDER BY o.apellido, o.nombre;`);
  return res.rows;
};

const obtenerPorId = async (id) => {
  const res = await db.query(`${SELECT_CON_OPERARIO} WHERE uo.id = $1;`, [id]);
  return res.rows[0];
};

const obtenerPorOperario = async (idOperario) => {
  const res = await db.query('SELECT * FROM umbral_operario WHERE id_operario = $1;', [idOperario]);
  return res.rows[0];
};

const crear = async ({ idOperario, fcFatiga, fcSobreesfuerzo, idUsuario }) => {
  const res = await db.query(
    `INSERT INTO umbral_operario (id_operario, fc_fatiga, fc_sobreesfuerzo, id_usuario)
     VALUES ($1, $2, $3, $4)
     RETURNING id;`,
    [idOperario, fcFatiga, fcSobreesfuerzo, idUsuario || null],
  );
  return obtenerPorId(res.rows[0].id);
};

const actualizar = async (id, { idOperario, fcFatiga, fcSobreesfuerzo, idUsuario }) => {
  const res = await db.query(
    `UPDATE umbral_operario
     SET id_operario = $2, fc_fatiga = $3, fc_sobreesfuerzo = $4, id_usuario = $5, actualizado_en = now()
     WHERE id = $1
     RETURNING id;`,
    [id, idOperario, fcFatiga, fcSobreesfuerzo, idUsuario || null],
  );
  return res.rows[0] ? obtenerPorId(res.rows[0].id) : undefined;
};

const eliminar = async (id) => {
  const res = await db.query('DELETE FROM umbral_operario WHERE id = $1 RETURNING *;', [id]);
  return res.rows[0];
};

module.exports = {
  listar,
  obtenerPorId,
  obtenerPorOperario,
  crear,
  actualizar,
  eliminar,
};
