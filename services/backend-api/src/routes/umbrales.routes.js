const express = require('express');
const router = express.Router();
const umbralRiesgoController = require('../controllers/umbralRiesgo.controller');
const { auth, authorize } = require('../middlewares/auth');

// H0023: "Como responsable de Seguridad e Higiene quiero configurar los
// umbrales de detección de riesgo" — mismo esqueleto que consentimiento.routes.js.
const allowedRoles = ['seguridad', 'admin'];

router.get('/', auth, authorize(allowedRoles), umbralRiesgoController.obtenerVigente);
router.get('/historial', auth, authorize(allowedRoles), umbralRiesgoController.obtenerHistorial);
router.put('/', auth, authorize(allowedRoles), umbralRiesgoController.configurar);

module.exports = router;
