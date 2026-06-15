const { pool } = require('../database/connection');

async function findAll() {
  const { rows } = await pool.query(
    `SELECT d.*, w.nombre, w.apellido
     FROM devices d
     LEFT JOIN workers w ON d.worker_id = w.id
     ORDER BY d.created_at DESC`
  );
  return rows;
}

async function create(data) {
  const { name, mac_address, token, worker_id } = data;
  const { rows } = await pool.query(
    'INSERT INTO devices (name, mac_address, token, worker_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, mac_address, token, worker_id || null]
  );
  return rows[0];
}

async function findByToken(token) {
  const { rows } = await pool.query('SELECT * FROM devices WHERE token = $1', [token]);
  return rows[0] || null;
}

module.exports = { findAll, create, findByToken };
