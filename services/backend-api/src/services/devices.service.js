const crypto = require('crypto');
const devicesRepository = require('../repositories/devices.repository');

async function listDevices() {
  return await devicesRepository.findAll();
}

async function createDevice(data) {
  const { name, mac_address, worker_id } = data;
  if (!name || !mac_address) {
    throw Object.assign(new Error('Missing required fields: name, mac_address'), { status: 400 });
  }
  const token = crypto.randomBytes(32).toString('hex');
  return await devicesRepository.create({ name, mac_address, token, worker_id });
}

module.exports = { listDevices, createDevice };
