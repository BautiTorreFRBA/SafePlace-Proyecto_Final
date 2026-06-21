const db = require('../config/database');

const insertar = async (data) => {
  const { workerId, heartRate, stressLevel, timestamp } = data;
  
  const query = `
    INSERT INTO mediciones (worker_id, heart_rate, stress_level, measured_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  
  const values = [workerId, heartRate, stressLevel, timestamp || new Date()];
  
  const res = await db.query(query, values);
  return res.rows[0];
};

const obtenerTodas = async (filtros) => {
  const { limit = 100, offset = 0 } = filtros;
  
  const query = `
    SELECT * FROM mediciones
    ORDER BY measured_at DESC
    LIMIT $1 OFFSET $2;
  `;
  
  const res = await db.query(query, [limit, offset]);
  return res.rows;
};

module.exports = {
  insertar,
  obtenerTodas,
};
