const dispositivoRepository = require('../repositories/dispositivo.repository');

const listar = async (req, res, next) => {
  try {
    const wearables = await dispositivoRepository.listarDisponibles();
    res.status(200).json({ data: wearables });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
};
