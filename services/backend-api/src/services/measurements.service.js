const measurementsRepository = require('../repositories/measurements.repository');
const alertsRepository = require('../repositories/alerts.repository');
const { pool } = require('../database/connection');

async function getConfig() {
  const { rows } = await pool.query('SELECT key, value FROM configuration');
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.value) || r.value]));
}

async function ingestMeasurement(data) {
  const { worker_id, heart_rate, activity, timestamp } = data;
  if (!worker_id || heart_rate == null) {
    throw Object.assign(new Error('Missing required fields: worker_id, heart_rate'), { status: 400 });
  }

  const measurement = await measurementsRepository.create({ worker_id, heart_rate, activity, timestamp });

  const config = await getConfig();

  if (heart_rate >= config.fc_critico) {
    await alertsRepository.create({
      worker_id,
      type: 'critical_heart_rate',
      message: `Heart rate ${heart_rate} BPM exceeds critical threshold (${config.fc_critico} BPM)`,
    });
  } else if (heart_rate >= config.fc_max) {
    await alertsRepository.create({
      worker_id,
      type: 'high_heart_rate',
      message: `Heart rate ${heart_rate} BPM exceeds maximum threshold (${config.fc_max} BPM)`,
    });
  } else if (heart_rate <= config.fc_min) {
    await alertsRepository.create({
      worker_id,
      type: 'low_heart_rate',
      message: `Heart rate ${heart_rate} BPM is below minimum threshold (${config.fc_min} BPM)`,
    });
  }

  return measurement;
}

async function getMeasurementsByWorker(workerId) {
  return await measurementsRepository.findByWorker(workerId);
}

module.exports = { ingestMeasurement, getMeasurementsByWorker };
