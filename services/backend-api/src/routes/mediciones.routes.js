const express = require('express');
const router = express.Router();
const medicionesController = require('../controllers/mediciones.controller');
const medicionesHistorialController = require('../controllers/mediciones.historial.controller');
const deviceAuth = require('../middlewares/deviceAuth');
const { auth, authorize } = require('../middlewares/auth');

// Endpoint exclusivo para el Gateway BLE (On-Premise)
router.post('/', deviceAuth, medicionesController.crearMedicion);

// Historial para aplicaciones frontend (Supervisor)
router.get('/', auth, authorize(['supervisor']), medicionesHistorialController.getHistorialMediciones);
router.get('/historico', auth, authorize(['supervisor']), medicionesHistorialController.getHistorialMediciones);

module.exports = router;
