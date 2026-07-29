const express = require('express');
const router = express.Router();
const wearablesController = require('../controllers/wearables.controller');
const { auth, authorize } = require('../middlewares/auth');

router.get('/', auth, authorize(['admin']), wearablesController.listar);

module.exports = router;
