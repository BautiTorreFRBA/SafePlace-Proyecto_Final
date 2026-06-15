const express = require('express');
const router = express.Router();
const measurementsController = require('../controllers/measurements.controller');

router.post('/', measurementsController.ingestMeasurement);
router.get('/:id_trabajador', measurementsController.getMeasurementsByWorker);

module.exports = router;
