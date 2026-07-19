const medicionesService = require('../services/mediciones.service');

const crearMedicion = async (req, res, next) => {
  try {
    // Paquete del gateway (ver contrato en services/validacion/validacion-datos.service.js):
    // { idDispositivo, timestamp, frecuenciaCardiaca, nivelActividad,
    //   nivelInactividad, temperaturaCorporal, spo2 }
    // idTrabajador y fechaHora oficial los resuelve la validación (RF-03/RF-04).
    const nuevaMedicion = await medicionesService.registrarMedicion(req.body, {
      ipOrigen: req.ip,
    });
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
