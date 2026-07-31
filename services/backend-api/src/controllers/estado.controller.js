const estadoRepository = require('../repositories/estado.repository');

const getTrabajadoresActivos = async (req, res, next) => {
  try {
    const rows = await estadoRepository.listarTrabajadoresActivos();
    res.status(200).json({ data: rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTrabajadoresActivos,
};
