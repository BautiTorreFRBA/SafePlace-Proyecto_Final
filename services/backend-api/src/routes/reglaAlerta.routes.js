const express = require('express');
const router = express.Router();
const controller = require('../controllers/reglaAlerta.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, authorize(['admin']), controller.obtener);
router.put('/', auth, authorize(['admin']), controller.configurar);

module.exports = router;
