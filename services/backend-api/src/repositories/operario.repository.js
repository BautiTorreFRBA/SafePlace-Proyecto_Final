const db = require('../config/database');

const listarActivos = async (usuario = {}) => {
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const turnoSeguridad = usuario.role === 'seguridad'
    ? (hora >= 8 && hora < 12 ? 'mañana' : hora >= 12 && hora < 16 ? 'tarde' : hora >= 16 && hora < 20 ? 'noche' : '__sin_turno_activo__')
    : null;
  const query = `
    SELECT id, id_empresa, legajo, nombre, apellido, area, turno, mail AS email, estado, alta
    FROM operario
    WHERE estado IS TRUE
      AND ($1::text IS NULL OR turno = $1)
    ORDER BY apellido, nombre, id;
  `;

  const result = await db.query(query, [turnoSeguridad]);
  return result.rows;
};

const obtenerPorId = async (id) => {
  const query = `
    SELECT id, id_empresa, legajo, nombre, apellido, area, mail AS email, estado, alta
    FROM operario
    WHERE id = $1;
  `;

  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

const crear = async ({
  idEmpresa, legajo, nombre, apellido, area, estado = true, alta,
}) => {
  const query = `
    INSERT INTO operario (id_empresa, legajo, nombre, apellido, area, estado, alta)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const result = await db.query(query, [
    idEmpresa, legajo, nombre, apellido, area || null, estado, alta || null,
  ]);
  return result.rows[0];
};

module.exports = {
  listarActivos,
  obtenerPorId,
  crear,
};
