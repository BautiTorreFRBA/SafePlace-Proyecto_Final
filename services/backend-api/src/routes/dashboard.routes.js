const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
<<<<<<< HEAD

router.get('/employees', dashboardController.getEmpleados);
router.get('/measurements', dashboardController.getMediciones);
router.get('/devices', dashboardController.getDispositivos);
router.get('/alerts', dashboardController.getAlertas);
=======
const { auth, authorize } = require('../middlewares/auth');

router.get('/employees', auth, authorize(['admin']), dashboardController.getEmpleados);
router.get('/users', auth, authorize(['admin']), dashboardController.getUsuarios);
router.get('/measurements', auth, authorize(['admin', 'supervisor', 'seguridad']), dashboardController.getMediciones);
router.get('/devices', auth, authorize(['admin', 'supervisor']), dashboardController.getDispositivos);
router.get('/alerts', auth, authorize(['admin', 'supervisor', 'seguridad']), dashboardController.getAlertas);
>>>>>>> BorrarDatosSimulados

module.exports = router;
