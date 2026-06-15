const express = require('express');
const router = express.Router();
const devicesController = require('../controllers/devices.controller');

router.get('/', devicesController.listDevices);
router.post('/', devicesController.createDevice);

module.exports = router;
