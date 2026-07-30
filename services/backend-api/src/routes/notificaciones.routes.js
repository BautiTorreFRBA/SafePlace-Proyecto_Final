const express = require('express');
const router = express.Router();
const notificacionController = require('../controllers/notificacion.controller');
const { auth, authorize } = require('../middlewares/auth');

// H0015: "Como supervisor operativo quiero recibir notificaciones" — mismos
// roles que ya ven alertas en el dashboard (admin/supervisor/seguridad).
const allowedRoles = ['admin', 'supervisor', 'seguridad'];

router.get('/stream', auth, authorize(allowedRoles), notificacionController.stream);
router.get('/', auth, authorize(allowedRoles), notificacionController.listar);
router.patch('/:id/leida', auth, authorize(allowedRoles), notificacionController.marcarLeida);

module.exports = router;
