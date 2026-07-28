const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { auth, authorize } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/users', auth, authorize(['admin']), authController.crearUsuario);

module.exports = router;
