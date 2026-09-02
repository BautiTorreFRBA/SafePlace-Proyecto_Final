const reglaAlertaService = require('../services/reglaAlerta.service');

const actorDesdeRequest = (req) => ({ id: req.user?.sub, ip: req.ip });

const obtener = async (req, res, next) => {
  try {
    res.json({ data: await reglaAlertaService.obtener() });
  } catch (error) {
    next(error);
  }
};

const configurar = async (req, res, next) => {
  try {
    const data = await reglaAlertaService.configurar(req.body?.reglas, actorDesdeRequest(req));
    res.status(200).json({ message: 'Reglas de alerta configuradas.', data });
  } catch (error) {
    next(error);
  }
};

module.exports = { obtener, configurar };
