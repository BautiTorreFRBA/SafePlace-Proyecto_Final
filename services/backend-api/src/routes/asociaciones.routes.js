const express = require('express');
const router = express.Router();
const asociacionesController = require('../controllers/asociaciones.controller');
const { auth, authorize } = require('../middlewares/auth');

router.post('/', auth, authorize(['admin']), asociacionesController.crear);
router.put('/:id', auth, authorize(['admin']), asociacionesController.actualizar);
router.patch('/:id', auth, authorize(['admin']), asociacionesController.finalizar);

module.exports = router;
