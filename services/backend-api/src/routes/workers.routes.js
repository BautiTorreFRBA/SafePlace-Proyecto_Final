const express = require('express');
const router = express.Router();
const workersController = require('../controllers/workers.controller');
const verifyToken = require('../middlewares/auth.middleware');

router.get('/', verifyToken, workersController.listWorkers);
router.post('/', verifyToken, workersController.createWorker);
router.put('/:id', verifyToken, workersController.updateWorker);
router.patch('/:id/deactivate', verifyToken, workersController.deactivateWorker);

module.exports = router;
