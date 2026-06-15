const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alerts.controller');

router.get('/', alertsController.listAlerts);
router.patch('/:id/status', alertsController.updateAlertStatus);

module.exports = router;
