const db = require('../config/database');

const REGLAS = ['Fatiga', 'Inactividad', 'Sobreesfuerzo'];

const listar = async () => {
  const result = await db.query(
    `SELECT nombre, valor_minimo, valor_maximo
     FROM regla_alerta
     WHERE lower(nombre) = ANY($1::varchar[])
     ORDER BY array_position($1::varchar[], lower(nombre));`,
    [REGLAS.map((nombre) => nombre.toLowerCase())],
  );
  return result.rows;
};

const guardarTodas = async ({ reglas }) => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const registros = [];
    for (const nombre of REGLAS) {
      const result = await client.query(
        `UPDATE regla_alerta
         SET valor_minimo = $2, valor_maximo = $3
         WHERE lower(nombre) = lower($1)
         RETURNING nombre, valor_minimo, valor_maximo;`,
        [nombre, reglas[nombre].valorMinimo, reglas[nombre].valorMaximo],
      );
      if (!result.rows[0]) {
        const error = new Error(`No existe la regla '${nombre}' en la base de datos.`);
        error.status = 404;
        error.motivo = 'REGLA_ALERTA_NO_ENCONTRADA';
        throw error;
      }
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

module.exports = { REGLAS, listar, guardarTodas };
