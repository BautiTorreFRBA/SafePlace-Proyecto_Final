const db = require('../config/database');

// "Configuración particular": FC propias de un operario, guardadas en
// operario."FC_Fatiga" / operario."FC_Sobreesfuerzo" (NULL = usa el umbral
// global). Las columnas tienen mayúsculas en Neon, por eso van entre comillas.
// Ver migración 20260925000001_add-fc-particular-a-operario.

const SELECT_PARTICULAR = `
  SELECT
    o.id,
    o.id AS id_operario,
    o."FC_Fatiga" AS fc_fatiga,
    o."FC_Sobreesfuerzo" AS fc_sobreesfuerzo,
    o.nombre AS operario_nombre,
    o.apellido AS operario_apellido,
    o.legajo AS operario_legajo,
    o.area AS operario_area,
    o.turno AS operario_turno,
    o.estado AS operario_estado
  FROM operario o
`;
const TIENE_PARTICULAR = '(o."FC_Fatiga" IS NOT NULL OR o."FC_Sobreesfuerzo" IS NOT NULL)';

const listar = async () => {
  const res = await db.query(`${SELECT_PARTICULAR} WHERE ${TIENE_PARTICULAR} ORDER BY o.apellido, o.nombre, o.id;`);
  return res.rows;
};

// Devuelve la configuración particular del operario, o undefined si no tiene
// (ambas FC en NULL) o si el operario no existe.
const obtenerPorOperario = async (idOperario) => {
  const res = await db.query(`${SELECT_PARTICULAR} WHERE o.id = $1 AND ${TIENE_PARTICULAR};`, [idOperario]);
  return res.rows[0];
};

const guardar = async (idOperario, { fcFatiga, fcSobreesfuerzo }) => {
  const res = await db.query(
    'UPDATE operario SET "FC_Fatiga" = $2, "FC_Sobreesfuerzo" = $3 WHERE id = $1 RETURNING id;',
    [idOperario, fcFatiga, fcSobreesfuerzo],
  );
  return res.rows[0] ? obtenerPorOperario(idOperario) : undefined;
};

const eliminar = async (idOperario) => {
  const existente = await obtenerPorOperario(idOperario);
  if (!existente) return undefined;
  await db.query('UPDATE operario SET "FC_Fatiga" = NULL, "FC_Sobreesfuerzo" = NULL WHERE id = $1;', [idOperario]);
  return existente;
};

module.exports = {
  listar,
  obtenerPorOperario,
  guardar,
  eliminar,
};
