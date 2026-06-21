const medicionesRepository = require('../repositories/mediciones.repository');

const registrarMedicion = async (data) => {
  // Aquí se podrían agregar validaciones de negocio adicionales
  if (!data.workerId || !data.heartRate) {
    const error = new Error('Datos incompletos: workerId y heartRate son obligatorios.');
    error.status = 400;
    throw error;
  }
  
  return await medicionesRepository.insertar(data);
};

const listarMediciones = async (filtros) => {
  return await medicionesRepository.obtenerTodas(filtros);
};

module.exports = {
  registrarMedicion,
  listarMediciones,
};
