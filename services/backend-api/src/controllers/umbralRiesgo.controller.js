const umbralRiesgoService = require('../services/umbralRiesgo.service');

const actorDesdeRequest = (req) => ({ id: req.user?.sub, ip: req.ip });

const configurar = async (req, res, next) => {
  try {
    const {
      fcFatiga,
      minutosFatiga,
      fcSobreesfuerzo,
      actividadSobreesfuerzo,
      minutosInactividad,
    } = req.body;

    const registro = await umbralRiesgoService.configurar(
      { fcFatiga, minutosFatiga, fcSobreesfuerzo, actividadSobreesfuerzo, minutosInactividad },
      actorDesdeRequest(req),
    );

    res.status(200).json({ message: 'Umbrales de riesgo configurados.', data: registro });
  } catch (error) {
    next(error);
  }
};

const obtenerVigente = async (req, res, next) => {
  try {
    const registro = await umbralRiesgoService.obtenerVigente();
    res.status(200).json({ data: registro || null });
  } catch (error) {
    next(error);
  }
};

const obtenerHistorial = async (req, res, next) => {
  try {
    const registros = await umbralRiesgoService.obtenerHistorial();
    res.status(200).json({ data: registros });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  configurar,
  obtenerVigente,
  obtenerHistorial,
};
