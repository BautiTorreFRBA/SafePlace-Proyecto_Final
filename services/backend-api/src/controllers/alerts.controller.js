const alertsService = require('../services/alerts.service');

async function listAlerts(req, res, next) {
  try {
    const alerts = await alertsService.listAlerts();
    res.status(200).json(alerts);
  } catch (err) {
    next(err);
  }
}

async function updateAlertStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const alert = await alertsService.updateAlertStatus(id, status);
    res.status(200).json(alert);
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts, updateAlertStatus };
