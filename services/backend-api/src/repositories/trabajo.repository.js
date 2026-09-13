const db = require('../config/database');

// trabajo es estado actual (no append-only): se edita in-place, igual que
// horario_operario.

const listar = async () => {
  const res = await db.query('SELECT * FROM trabajo ORDER BY nombre;');
  return res.rows;
};

const listarActivos = async () => {
  const res = await db.query('SELECT * FROM trabajo WHERE activo = true ORDER BY nombre;');
  return res.rows;
};

const obtenerPorId = async (id) => {
  const res = await db.query('SELECT * FROM trabajo WHERE id = $1;', [id]);
  return res.rows[0];
};

const crear = async ({
  nombre,
  descripcion,
  fcFatiga,
  minutosFatiga,
  fcSobreesfuerzo,
  actividadSobreesfuerzo,
  minutosInactividad,
  minutosDesconexionTolerada,
  idUsuario,
}) => {
  const query = `
    INSERT INTO trabajo (
      nombre, descripcion, fc_fatiga, minutos_fatiga, fc_sobreesfuerzo,
      actividad_sobreesfuerzo, minutos_inactividad, minutos_desconexion_tolerada,
      id_usuario
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;
  const res = await db.query(query, [
    nombre,
    descripcion || null,
    fcFatiga,
    minutosFatiga,
    fcSobreesfuerzo,
    actividadSobreesfuerzo,
    minutosInactividad,
    minutosDesconexionTolerada,
    idUsuario || null,
  ]);
  return res.rows[0];
};

const actualizar = async (id, {
  nombre,
  descripcion,
  activo,
  fcFatiga,
  minutosFatiga,
  fcSobreesfuerzo,
  actividadSobreesfuerzo,
  minutosInactividad,
  minutosDesconexionTolerada,
  idUsuario,
}) => {
  const query = `
    UPDATE trabajo SET
      nombre = $2, descripcion = $3, activo = $4, fc_fatiga = $5, minutos_fatiga = $6,
      fc_sobreesfuerzo = $7, actividad_sobreesfuerzo = $8, minutos_inactividad = $9,
      minutos_desconexion_tolerada = $10, id_usuario = $11, actualizado_en = now()
    WHERE id = $1
    RETURNING *;
  `;
  const res = await db.query(query, [
    id,
    nombre,
    descripcion || null,
    activo,
    fcFatiga,
    minutosFatiga,
    fcSobreesfuerzo,
    actividadSobreesfuerzo,
    minutosInactividad,
    minutosDesconexionTolerada,
    idUsuario || null,
  ]);
  return res.rows[0];
};

module.exports = {
  listar,
  listarActivos,
  obtenerPorId,
  crear,
  actualizar,
};
