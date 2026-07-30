const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/companies', auth, authorize(['admin']), dashboardController.getEmpresas);
router.get('/employees', auth, authorize(['admin']), dashboardController.getEmpleados);
router.post('/employees', auth, authorize(['admin']), dashboardController.crearEmpleado);
router.patch('/employees/:id', auth, authorize(['admin']), dashboardController.actualizarEmpleado);
router.patch('/employees/:id/deactivate', auth, authorize(['admin']), dashboardController.desactivarEmpleado);
router.get('/users', auth, authorize(['admin']), dashboardController.getUsuarios);
router.patch('/users/:id', auth, authorize(['admin']), dashboardController.actualizarUsuario);
router.patch('/users/:id/deactivate', auth, authorize(['admin']), dashboardController.desactivarUsuario);
router.get('/measurements', auth, authorize(['admin', 'supervisor', 'seguridad']), dashboardController.getMediciones);
router.get('/devices', auth, authorize(['admin', 'supervisor', 'seguridad']), dashboardController.getDispositivos);
router.get('/alerts', auth, authorize(['admin', 'supervisor', 'seguridad']), dashboardController.getAlertas);

module.exports = router;
