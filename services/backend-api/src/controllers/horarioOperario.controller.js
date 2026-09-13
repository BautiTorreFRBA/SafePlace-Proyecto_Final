const horarioOperarioService = require('../services/horarioOperario.service');

const actorDesdeRequest = (req) => ({ id: req.user?.sub, ip: req.ip });

const obtener = async (req, res, next) => {
  try {
    const data = await horarioOperarioService.obtenerPorOperario(Number(req.params.id));
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const configurar = async (req, res, next) => {
  try {
    const ventanas = req.body?.ventanas ?? req.body;
    const data = await horarioOperarioService.configurar(
      Number(req.params.id),
      ventanas,
      actorDesdeRequest(req),
    );
    res.status(200).json({ message: 'Horario laboral actualizado.', data });
  } catch (error) {
    next(error);
  }
};

const agregarExcepcion = async (req, res, next) => {
  try {
    const { fecha, horaInicio, horaFin, idTrabajo } = req.body;
    const data = await horarioOperarioService.agregarExcepcion(
      Number(req.params.id),
      { fecha, horaInicio, horaFin, idTrabajo },
      actorDesdeRequest(req),
    );
    res.status(201).json({ message: 'Excepción horaria agregada.', data });
  } catch (error) {
    next(error);
  }
};

const eliminarExcepcion = async (req, res, next) => {
  try {
    await horarioOperarioService.eliminarExcepcion(
      Number(req.params.id),
      Number(req.params.idExcepcion),
      actorDesdeRequest(req),
    );
    res.status(200).json({ message: 'Excepción horaria eliminada.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  obtener,
  configurar,
  agregarExcepcion,
  eliminarExcepcion,
};
