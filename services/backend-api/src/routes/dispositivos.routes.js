const express = require('express');
const router = express.Router();
const dispositivosController = require('../controllers/dispositivos.controller');
const deviceAuth = require('../middlewares/deviceAuth');
const { auth, authorize } = require('../middlewares/auth');

// El hub no tiene sesión de usuario: se autentica igual que POST /mediciones.
router.get('/lookup', deviceAuth, dispositivosController.lookupPorMac);
router.post('/:id/estado-conexion', deviceAuth, dispositivosController.registrarEstadoConexion);

// Visibilidad para el administrador (H0007).
router.get('/estado-conexion', auth, authorize(['admin']), dispositivosController.listarEstadoConexion);

module.exports = router;
