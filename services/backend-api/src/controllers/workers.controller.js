const workersService = require('../services/workers.service');

async function listWorkers(req, res, next) {
  try {
    const workers = await workersService.listWorkers();
    res.status(200).json(workers);
  } catch (err) {
    next(err);
  }
}

async function createWorker(req, res, next) {
  try {
    const worker = await workersService.createWorker(req.body);
    res.status(201).json(worker);
  } catch (err) {
    next(err);
  }
}

async function updateWorker(req, res, next) {
  try {
    const worker = await workersService.updateWorker(req.params.id, req.body);
    res.status(200).json(worker);
  } catch (err) {
    next(err);
  }
}

async function deactivateWorker(req, res, next) {
  try {
    const worker = await workersService.deactivateWorker(req.params.id);
    res.status(200).json(worker);
  } catch (err) {
    next(err);
  }
}

module.exports = { listWorkers, createWorker, updateWorker, deactivateWorker };
