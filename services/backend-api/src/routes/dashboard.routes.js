const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

router.get('/employees', dashboardController.getEmpleados);
router.get('/measurements', dashboardController.getMediciones);
router.get('/devices', dashboardController.getDispositivos);
router.get('/alerts', dashboardController.getAlertas);

module.exports = router;
