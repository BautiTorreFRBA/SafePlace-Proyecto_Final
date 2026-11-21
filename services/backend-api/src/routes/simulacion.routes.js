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

// Latido del simulador de demo. El POST entra con la API key del gateway (el
// script no tiene JWT); el GET lo usa el frontend para pintar la luna, y queda
// abierto a cualquier sesion valida porque es estado de demo, no dato sensible.
router.post('/latido', deviceAuth, simulacionController.registrarLatido);
router.get('/latido', eitherAuth, simulacionController.obtenerLatido);
router.get('/operarios', auth, authorize(['admin']), simulacionController.listarOperarios);
// Solo admin puede prender / apagar
router.put('/', auth, authorize(['admin']), simulacionController.actualizarEstado);

module.exports = router;
