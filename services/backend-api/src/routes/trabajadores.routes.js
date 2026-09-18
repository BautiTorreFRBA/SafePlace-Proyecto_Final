const express = require('express');
const router = express.Router();
const trabajadoresController = require('../controllers/trabajadores.controller');
const horarioOperarioController = require('../controllers/horarioOperario.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, authorize(['admin', 'supervisor', 'seguridad']), trabajadoresController.listar);

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

// Excepciones puntuales por fecha de calendario (reemplazan lo recurrente
// sólo para esa fecha): mismos roles que el horario recurrente.
router.post(
  '/:id/horario/excepciones',
  auth,
  authorize(['admin', 'seguridad']),
  horarioOperarioController.agregarExcepcion,
);
router.delete(
  '/:id/horario/excepciones/:idExcepcion',
  auth,
  authorize(['admin', 'seguridad']),
  horarioOperarioController.eliminarExcepcion,
);

module.exports = router;
