const express = require('express');
const router = express.Router();
const simulacionController = require('../controllers/simulacion.controller');
const { auth, authorize } = require('../middlewares/auth');
const deviceAuth = require('../middlewares/deviceAuth');

// El simulador consulta el estado usando su API key (misma que el hub)
router.get('/', deviceAuth, simulacionController.obtenerEstado);
// Solo admin puede prender / apagar
router.put('/', auth, authorize(['admin']), simulacionController.actualizarEstado);

module.exports = router;
