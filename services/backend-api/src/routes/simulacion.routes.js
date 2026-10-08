const express = require('express');
const router = express.Router();
const simulacionController = require('../controllers/simulacion.controller');
const { auth, authorize } = require('../middlewares/auth');
const deviceAuth = require('../middlewares/deviceAuth');

// El simulador usa su API key; el frontend usa JWT — se acepta cualquiera de los dos.
const eitherAuth = (req, res, next) => {
  if (req.headers['x-device-api-key']) return deviceAuth(req, res, next);
  return auth(req, res, next);
};
router.get('/', eitherAuth, simulacionController.obtenerEstado);
// Solo admin puede prender / apagar
router.put('/', auth, authorize(['admin']), simulacionController.actualizarEstado);

module.exports = router;
