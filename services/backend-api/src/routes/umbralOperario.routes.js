const express = require('express');
const router = express.Router();
const umbralOperarioController = require('../controllers/umbralOperario.controller');
const { auth, authorize } = require('../middlewares/auth');

// "Configuración particular": FC de fatiga/sobreesfuerzo propias de un
// operario. Mismos roles que /umbrales (el umbral global que reemplazan).
const allowedRoles = ['seguridad', 'admin'];
const allowedReadRoles = [...allowedRoles, 'supervisor'];

// Consulta necesaria para que el supervisor vea los umbrales individuales en
// el gráfico; las operaciones de escritura siguen restringidas.
router.get('/', auth, authorize(allowedReadRoles), umbralOperarioController.listar);
router.post('/', auth, authorize(allowedRoles), umbralOperarioController.crear);
router.put('/:id', auth, authorize(allowedRoles), umbralOperarioController.actualizar);
router.delete('/:id', auth, authorize(allowedRoles), umbralOperarioController.eliminar);

module.exports = router;
