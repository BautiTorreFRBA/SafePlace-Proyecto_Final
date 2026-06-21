const medicionesService = require('../services/mediciones.service');

const crearMedicion = async (req, res, next) => {
  try {
    const data = req.body;
    // data esperada: { deviceId, workerId, heartRate, stressLevel, timestamp }
    const nuevaMedicion = await medicionesService.registrarMedicion(data);
    res.status(201).json({ message: 'Medición registrada exitosamente', data: nuevaMedicion });
  } catch (error) {
    next(error);
  }
};

const obtenerMediciones = async (req, res, next) => {
  try {
    const filtros = req.query; // Paginación y filtros
    const mediciones = await medicionesService.listarMediciones(filtros);
    res.status(200).json({ data: mediciones });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  crearMedicion,
  obtenerMediciones,
};
