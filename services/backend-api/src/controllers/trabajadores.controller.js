const operarioRepository = require('../repositories/operario.repository');

const listar = async (req, res, next) => {
  try {
    const trabajadores = await operarioRepository.listarActivos(req.user);
    res.status(200).json({ data: trabajadores });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
};
