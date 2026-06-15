const devicesService = require('../services/devices.service');

async function listDevices(req, res, next) {
  try {
    const devices = await devicesService.listDevices();
    res.status(200).json(devices);
  } catch (err) {
    next(err);
  }
}

async function createDevice(req, res, next) {
  try {
    const device = await devicesService.createDevice(req.body);
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
}

module.exports = { listDevices, createDevice };
