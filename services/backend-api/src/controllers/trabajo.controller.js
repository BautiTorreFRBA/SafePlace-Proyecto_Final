const trabajoService = require('../services/trabajo.service');

const actorDesdeRequest = (req) => ({ id: req.user?.sub, ip: req.ip });

const camposDesdeBody = (body) => ({
  nombre: body.nombre,
  descripcion: body.descripcion,
  activo: body.activo,
  fcFatiga: body.fcFatiga,
  minutosFatiga: body.minutosFatiga,
  fcSobreesfuerzo: body.fcSobreesfuerzo,
  actividadSobreesfuerzo: body.actividadSobreesfuerzo,
  minutosInactividad: body.minutosInactividad,
  minutosDesconexionTolerada: body.minutosDesconexionTolerada,
});

const listar = async (req, res, next) => {
  try {
    const data = await trabajoService.listar();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const registro = await trabajoService.crear(camposDesdeBody(req.body), actorDesdeRequest(req));
    res.status(201).json({ message: 'Trabajo creado.', data: registro });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const registro = await trabajoService.actualizar(
      Number(req.params.id),
      camposDesdeBody(req.body),
      actorDesdeRequest(req),
    );
    res.status(200).json({ message: 'Trabajo actualizado.', data: registro });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
  crear,
  actualizar,
};
