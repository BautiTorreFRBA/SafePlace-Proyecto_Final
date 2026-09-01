const db = require('../config/database');

const TIPOS = ['FATIGA', 'INACTIVIDAD', 'SOBREESFUERZO'];

const listar = async () => {
  const result = await db.query(
    `SELECT id, tipo, parametros, id_usuario, fecha_hora
     FROM regla_alerta
     WHERE tipo = ANY($1::varchar[])
     ORDER BY array_position($1::varchar[], tipo);`,
    [TIPOS],
  );
  return result.rows;
};

const guardar = async ({ tipo, parametros, idUsuario }) => {
  const result = await db.query(
    `INSERT INTO regla_alerta (tipo, parametros, id_usuario)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (tipo) DO UPDATE SET
       parametros = EXCLUDED.parametros,
       id_usuario = EXCLUDED.id_usuario,
       fecha_hora = now()
     RETURNING id, tipo, parametros, id_usuario, fecha_hora;`,
    [tipo, JSON.stringify(parametros), idUsuario || null],
  );
  return result.rows[0];
};

const guardarTodas = async ({ reglas, idUsuario }) => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const registros = [];
    for (const tipo of TIPOS) {
      const result = await client.query(
        `INSERT INTO regla_alerta (tipo, parametros, id_usuario)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (tipo) DO UPDATE SET
           parametros = EXCLUDED.parametros,
           id_usuario = EXCLUDED.id_usuario,
           fecha_hora = now()
         RETURNING id, tipo, parametros, id_usuario, fecha_hora;`,
        [tipo, JSON.stringify(reglas[tipo]), idUsuario || null],
      );
      registros.push(result.rows[0]);
    }
    await client.query('COMMIT');
    return registros;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { TIPOS, listar, guardar, guardarTodas };
