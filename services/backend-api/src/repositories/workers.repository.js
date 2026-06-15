const { pool } = require('../database/connection');

async function findAll() {
  const { rows } = await pool.query('SELECT * FROM workers ORDER BY created_at DESC');
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM workers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(data) {
  const { nombre, apellido, dni, area } = data;
  const { rows } = await pool.query(
    'INSERT INTO workers (nombre, apellido, dni, area) VALUES ($1, $2, $3, $4) RETURNING *',
    [nombre, apellido, dni, area]
  );
  return rows[0];
}

async function update(id, data) {
  const { nombre, apellido, dni, area } = data;
  const { rows } = await pool.query(
    'UPDATE workers SET nombre = $1, apellido = $2, dni = $3, area = $4 WHERE id = $5 RETURNING *',
    [nombre, apellido, dni, area, id]
  );
  return rows[0] || null;
}

async function deactivate(id) {
  const { rows } = await pool.query(
    'UPDATE workers SET estado = $1 WHERE id = $2 RETURNING *',
    ['inactivo', id]
  );
  return rows[0] || null;
}

module.exports = { findAll, findById, create, update, deactivate };
