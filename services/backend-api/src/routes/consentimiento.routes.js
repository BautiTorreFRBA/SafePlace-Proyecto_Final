const express = require('express');
const router = express.Router();
const consentimientoController = require('../controllers/consentimiento.controller');
const { auth, authorize } = require('../middlewares/auth');

router.post('/', auth, authorize(['admin']), consentimientoController.otorgar);
router.post('/confirmar', consentimientoController.confirmar);
router.post('/:idTrabajador/revocar', auth, authorize(['admin']), consentimientoController.revocar);
router.get('/:idTrabajador', auth, authorize(['admin']), consentimientoController.historial);

module.exports = router;
