const express = require('express');
const router = express.Router();
const trabajoController = require('../controllers/trabajo.controller');
const { auth, authorize } = require('../middlewares/auth');

// Tipos de trabajo con umbrales propios, asignables por ventana en
// horario_operario. Lectura habilitada también para supervisor porque
// Horarios Laborales necesita poblar el selector; escritura reservada a
// Seguridad e Higiene / Administración, igual que /umbrales.
const rolesLectura = ['admin', 'seguridad', 'supervisor'];
const rolesEscritura = ['admin', 'seguridad'];

router.get('/', auth, authorize(rolesLectura), trabajoController.listar);
router.post('/', auth, authorize(rolesEscritura), trabajoController.crear);
router.put('/:id', auth, authorize(rolesEscritura), trabajoController.actualizar);

module.exports = router;
