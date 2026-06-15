const { pool } = require('../database/connection');

async function findAll() {
  const { rows } = await pool.query(
    `SELECT a.*, w.nombre, w.apellido
     FROM alerts a
     JOIN workers w ON a.worker_id = w.id
     ORDER BY a.created_at DESC`
  );
  return rows;
}

async function create(data) {
  const { worker_id, type, message } = data;
  const { rows } = await pool.query(
    'INSERT INTO alerts (worker_id, type, message) VALUES ($1, $2, $3) RETURNING *',
    [worker_id, type, message]
  );
  return rows[0];
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    'UPDATE alerts SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
}

module.exports = { findAll, create, updateStatus };
