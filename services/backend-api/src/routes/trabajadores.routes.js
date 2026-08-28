const express = require('express');
const router = express.Router();
const trabajadoresController = require('../controllers/trabajadores.controller');
const horarioOperarioController = require('../controllers/horarioOperario.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, authorize(['admin']), trabajadoresController.listar);

// CP-E2E-04 / H0012: horario laboral del operario (ventana en la que se
// espera el wearable conectado). Lectura para supervisión; escritura para
// Seguridad e Higiene / Administración (mismo criterio que /umbrales).
router.get(
  '/:id/horario',
  auth,
  authorize(['admin', 'seguridad', 'supervisor']),
  horarioOperarioController.obtener,
);
router.put(
  '/:id/horario',
  auth,
  authorize(['admin', 'seguridad']),
  horarioOperarioController.configurar,
);

module.exports = router;
