const consentimientoService = require('../services/consentimiento.service');

const actorDesdeRequest = (req) => ({ id: req.user?.sub, ip: req.ip });

const otorgar = async (req, res, next) => {
  try {
    const { idTrabajador, versionPolitica } = req.body;
    const registro = await consentimientoService.otorgar(
      { idTrabajador, versionPolitica },
      actorDesdeRequest(req),
    );
    res.status(201).json({ message: 'Consentimiento otorgado.', data: registro });
  } catch (error) {
    next(error);
  }
};

const revocar = async (req, res, next) => {
  try {
    const registro = await consentimientoService.revocar(
      Number(req.params.idTrabajador),
      actorDesdeRequest(req),
    );
    res.status(200).json({ message: 'Consentimiento revocado.', data: registro });
  } catch (error) {
    next(error);
  }
};

const confirmar = async (req, res, next) => {
  try {
    const registro = await consentimientoService.confirmar(req.body?.token || req.query?.token);
    res.status(200).json({ message: 'Consentimiento confirmado.', data: registro });
  } catch (error) {
    next(error);
  }
};

const historial = async (req, res, next) => {
  try {
    const registros = await consentimientoService.obtenerHistorial(
      Number(req.params.idTrabajador),
    );
    res.status(200).json({ data: registros });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  otorgar,
  revocar,
  confirmar,
  historial,
};
