// Placeholder for database connection logic
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true }
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };

const pool = new Pool(poolConfig);

async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('[Backend API] Connected to PostgreSQL');
    client.release();
  } catch (err) {
    console.error('[Backend API] PostgreSQL connection error', err.stack);
    throw err;
  }
}

module.exports = {
  pool,
  connectDB
};
