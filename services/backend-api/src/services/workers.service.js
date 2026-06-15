const workersRepository = require('../repositories/workers.repository');

async function listWorkers() {
  return await workersRepository.findAll();
}

async function createWorker(data) {
  const { nombre, apellido, dni, area } = data;
  if (!nombre || !apellido || !dni || !area) {
    throw Object.assign(new Error('Missing required fields: nombre, apellido, dni, area'), { status: 400 });
  }
  return await workersRepository.create(data);
}

async function updateWorker(id, data) {
  const worker = await workersRepository.update(id, data);
  if (!worker) throw Object.assign(new Error('Worker not found'), { status: 404 });
  return worker;
}

async function deactivateWorker(id) {
  const worker = await workersRepository.deactivate(id);
  if (!worker) throw Object.assign(new Error('Worker not found'), { status: 404 });
  return worker;
}

module.exports = { listWorkers, createWorker, updateWorker, deactivateWorker };
