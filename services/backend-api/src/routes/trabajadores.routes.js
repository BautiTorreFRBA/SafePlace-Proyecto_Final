const express = require('express');
const router = express.Router();
const trabajadoresController = require('../controllers/trabajadores.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, authorize(['admin']), trabajadoresController.listar);

module.exports = router;
