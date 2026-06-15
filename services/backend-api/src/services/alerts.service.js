const alertsRepository = require('../repositories/alerts.repository');

const VALID_STATUSES = ['open', 'acknowledged', 'closed'];

async function listAlerts() {
  return await alertsRepository.findAll();
}

async function updateAlertStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw Object.assign(
      new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`),
      { status: 400 }
    );
  }
  const alert = await alertsRepository.updateStatus(id, status);
  if (!alert) throw Object.assign(new Error('Alert not found'), { status: 404 });
  return alert;
}

module.exports = { listAlerts, updateAlertStatus };
