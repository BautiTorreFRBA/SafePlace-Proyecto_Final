const { pool } = require('../database/connection');

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function create(email, passwordHash, role) {
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
    [email, passwordHash, role]
  );
  return rows[0];
}

module.exports = { findByEmail, create };
