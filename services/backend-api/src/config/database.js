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

    // Neon (y producción en general) requieren TLS; el Postgres local de
    // docker-compose no lo expone, así que solo forzamos SSL contra Neon.
    const requiereSSL = process.env.DATABASE_URL.includes('neon.tech')
      || process.env.NODE_ENV === 'production';

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: requiereSSL ? { rejectUnauthorized: true } : false,
      max: 20, // Máximo de conexiones simultáneas por instancia
      idleTimeoutMillis: 30000,
      // 10 s: si Neon está en cold start (scale-to-zero) el primer connect
      // puede tardar varios segundos; 2 s daba timeout en el primer request.
      connectionTimeoutMillis: 10000,
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
