const { Pool } = require('pg');

let pool;

/**
 * Retorna el pool de conexiones Singleton para PostgreSQL (Neon).
 */
const getPool = () => {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL no está definida en las variables de entorno.");
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true, // Requerido por Neon Serverless para asegurar el cifrado
      },
      max: 20, // Máximo de conexiones simultáneas por instancia
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }
  return pool;
};

module.exports = {
  getPool,
  query: (text, params) => getPool().query(text, params),
};
