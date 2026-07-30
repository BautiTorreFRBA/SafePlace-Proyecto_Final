const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alerts.controller');
const { auth, authorize } = require('../middlewares/auth');

const allowedRoles = ['admin', 'supervisor', 'seguridad'];

router.get('/', auth, authorize(allowedRoles), alertsController.getHistorialAlertas);
router.get('/historico', auth, authorize(allowedRoles), alertsController.getHistorialAlertas);
router.get('/activas', auth, authorize(allowedRoles), alertsController.getAlertasActivas);
router.patch('/:id', auth, authorize(allowedRoles), alertsController.actualizarEstado);

module.exports = router;
