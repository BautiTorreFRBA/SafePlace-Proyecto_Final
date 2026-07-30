const crypto = require('crypto');
const db = require('../config/database');

// H0020: identificador opaco (32 bytes aleatorios en hex), no derivable a
// partir del id de operario ni de ningún otro dato civil.
const generarIdentificador = () => crypto.randomBytes(32).toString('hex');

const obtenerPorOperario = async (idOperario) => {
  const res = await db.query(
    'SELECT * FROM operario_seudonimo WHERE id_operario = $1;',
    [idOperario],
  );
  return res.rows[0];
};

// Alta idempotente: si el operario ya tiene seudónimo, lo devuelve; si no,
// lo crea. La carrera entre dos paquetes del mismo operario procesados en
// paralelo la resuelve el índice único (id_operario) vía ON CONFLICT.
const obtenerOCrearPorOperario = async (idOperario) => {
  const existente = await obtenerPorOperario(idOperario);
  if (existente) return existente;

  const insert = await db.query(
    `INSERT INTO operario_seudonimo (id_operario, identificador_seudonimo)
     VALUES ($1, $2)
     ON CONFLICT (id_operario) DO NOTHING
     RETURNING *;`,
    [idOperario, generarIdentificador()],
  );
  if (insert.rows[0]) return insert.rows[0];

  return obtenerPorOperario(idOperario);
};

// Resuelve la identidad civil a partir del seudónimo (H0020: "tabla separada
// y protegida"). No expone endpoint propio — sólo debe invocarse desde rutas
// ya protegidas por auth + authorize (usuarios autorizados); una consulta
// sin pasar por ese gate nunca llega a este repositorio.
const resolverOperarioPorSeudonimo = async (idSeudonimo) => {
  const res = await db.query(
    `SELECT o.*
     FROM operario_seudonimo os
     JOIN operario o ON o.id = os.id_operario
     WHERE os.id = $1;`,
    [idSeudonimo],
  );
  return res.rows[0];
};

module.exports = {
  obtenerPorOperario,
  obtenerOCrearPorOperario,
  resolverOperarioPorSeudonimo,
};
