const express = require('express');
const router = express.Router();
const medicionesController = require('../controllers/mediciones.controller');
const deviceAuth = require('../middlewares/deviceAuth');
const { auth, authorize } = require('../middlewares/auth');

// Endpoint exclusivo para el Gateway BLE (On-Premise)
router.post('/', deviceAuth, medicionesController.crearMedicion);

// Endpoints para las aplicaciones frontend
router.get('/', auth, authorize(['admin', 'supervisor', 'seguridad']), medicionesController.obtenerMediciones);

module.exports = router;
