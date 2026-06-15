const { pool } = require('../database/connection');

async function create(data) {
  const { worker_id, heart_rate, activity, timestamp } = data;
  const { rows } = await pool.query(
    'INSERT INTO measurements (worker_id, heart_rate, activity, timestamp) VALUES ($1, $2, $3, $4) RETURNING *',
    [worker_id, heart_rate, activity, timestamp || new Date()]
  );
  return rows[0];
}

async function findByWorker(workerId) {
  const { rows } = await pool.query(
    'SELECT * FROM measurements WHERE worker_id = $1 ORDER BY timestamp DESC',
    [workerId]
  );
  return rows;
}

module.exports = { create, findByWorker };
