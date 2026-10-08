const simulacionRepository = require('../repositories/simulacion.repository');

const obtenerEstado = async (req, res, next) => {
  try {
    const estado = await simulacionRepository.obtenerEstado();
    res.json({ data: { activa: estado.simulacion_activa } });
  } catch (error) {
    next(error);
  }
};

const actualizarEstado = async (req, res, next) => {
  try {
    const { activa } = req.body ?? {};
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ error: '"activa" debe ser true o false.' });
    }
    const estado = await simulacionRepository.actualizarEstado(activa, req.usuario?.id ?? null);
    res.json({ data: { activa: estado.simulacion_activa } });
  } catch (error) {
    next(error);
  }
};

module.exports = { obtenerEstado, actualizarEstado };
