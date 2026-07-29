const asociacionesService = require('../services/asociaciones.service');

const actorDesde = (req) => ({ id: req.user?.sub, ip: req.ip });

const crear = async (req, res, next) => {
  try {
    const { idTrabajador, idDispositivo, fechaDesde } = req.body || {};
    const asignacion = await asociacionesService.crear(
      { idTrabajador, idDispositivo, fechaDesde },
      actorDesde(req),
    );
    res.status(201).json({ message: 'Wearable asociado correctamente.', data: asignacion });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = req.body || {};
    const asignacion = await asociacionesService.actualizar(
      req.params.id,
      { fechaDesde, fechaHasta },
      actorDesde(req),
    );
    res.status(200).json({ message: 'Asociación actualizada.', data: asignacion });
  } catch (error) {
    next(error);
  }
};

const finalizar = async (req, res, next) => {
  try {
    const asignacion = await asociacionesService.finalizar(req.params.id, actorDesde(req));
    res.status(200).json({ message: 'Asociación finalizada.', data: asignacion });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  crear,
  actualizar,
  finalizar,
};
