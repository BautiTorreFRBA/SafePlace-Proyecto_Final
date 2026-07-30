const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoria.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, authorize(['admin']), auditoriaController.listar);
router.put('/:id', auth, authorize(['admin']), auditoriaController.bloquearModificacion);
router.delete('/:id', auth, authorize(['admin']), auditoriaController.bloquearModificacion);

module.exports = router;
