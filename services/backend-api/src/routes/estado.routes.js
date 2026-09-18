const express = require('express');
const router = express.Router();
const estadoController = require('../controllers/estado.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/trabajadores-activos', auth, authorize(['admin', 'supervisor', 'seguridad', 'sin_rol']), estadoController.getTrabajadoresActivos);

module.exports = router;
