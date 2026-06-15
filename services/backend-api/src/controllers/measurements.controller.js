const measurementsService = require('../services/measurements.service');

async function ingestMeasurement(req, res, next) {
  try {
    const measurement = await measurementsService.ingestMeasurement(req.body);
    res.status(201).json(measurement);
  } catch (err) {
    next(err);
  }
}

async function getMeasurementsByWorker(req, res, next) {
  try {
    const { id_trabajador } = req.params;
    const measurements = await measurementsService.getMeasurementsByWorker(id_trabajador);
    res.status(200).json(measurements);
  } catch (err) {
    next(err);
  }
}

module.exports = { ingestMeasurement, getMeasurementsByWorker };
