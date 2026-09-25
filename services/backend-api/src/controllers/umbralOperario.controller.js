const umbralOperarioService = require('../services/umbralOperario.service');

const actorDesdeRequest = (req) => ({ id: req.user?.sub, ip: req.ip });

const camposDesdeBody = (body = {}) => ({
  idOperario: Number(body.idOperario),
  fcFatiga: Number(body.fcFatiga),
  fcSobreesfuerzo: Number(body.fcSobreesfuerzo),
});

const listar = async (req, res, next) => {
  try {
    const data = await umbralOperarioService.listar();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const registro = await umbralOperarioService.crear(camposDesdeBody(req.body), actorDesdeRequest(req));
    res.status(201).json({ message: 'Configuración particular creada.', data: registro });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const registro = await umbralOperarioService.actualizar(
      Number(req.params.id),
      camposDesdeBody(req.body),
      actorDesdeRequest(req),
    );
    res.status(200).json({ message: 'Configuración particular actualizada.', data: registro });
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    await umbralOperarioService.eliminar(Number(req.params.id), actorDesdeRequest(req));
    res.status(200).json({ message: 'Configuración particular eliminada.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar,
};
