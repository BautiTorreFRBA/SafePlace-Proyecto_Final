const express = require('express');
const router = express.Router();
const medicionesController = require('../controllers/mediciones.controller');
const medicionesHistorialController = require('../controllers/mediciones.historial.controller');
const deviceAuth = require('../middlewares/deviceAuth');
const { auth, authorize } = require('../middlewares/auth');

// Endpoint exclusivo para el Gateway BLE (On-Premise)
router.post('/', deviceAuth, medicionesController.crearMedicion);

// Historial para aplicaciones frontend (Supervisor)
// Fase 2 / S2: vista maestro — una fila por empleado con agregados del período.
// Seguridad e Higiene y el admin también usan la pantalla de Empleados (sin filtro de área).
router.get('/resumen', auth, authorize(['supervisor', 'seguridad', 'admin']), medicionesHistorialController.getResumenMediciones);
// Seguridad e Higiene también lo lee: el botón "Revisar" de Alertas Activas
// muestra la FC del día del operario involucrado.
// El admin lo usa en el Historial del empleado (tarjetas del Home).
router.get('/', auth, authorize(['supervisor', 'seguridad', 'admin']), medicionesHistorialController.getHistorialMediciones);
router.get('/historico', auth, authorize(['supervisor', 'seguridad', 'admin']), medicionesHistorialController.getHistorialMediciones);

module.exports = router;
