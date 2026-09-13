const operarioSeudonimoRepository = require('../repositories/operarioSeudonimo.repository');
const horarioOperarioRepository = require('../repositories/horarioOperario.repository');
const trabajoRepository = require('../repositories/trabajo.repository');
const umbralRiesgoRepository = require('../repositories/umbralRiesgo.repository');

/**
 * Resuelve qué umbral de riesgo aplica a un operario en un instante dado: el
 * de su `trabajo` asignado si su ventana de horario_operario vigente tiene
 * uno activo, o el umbral_riesgo global en cualquier otro caso (sin horario
 * vigente, sin trabajo asignado, o trabajo desactivado).
 */

const resolverPorOperario = async (idOperario, ts = new Date()) => {
  const ventana = await horarioOperarioRepository.obtenerVentanaVigente(idOperario, ts);
  if (ventana?.id_trabajo) {
    const trabajo = await trabajoRepository.obtenerPorId(ventana.id_trabajo);
    if (trabajo && trabajo.activo) return trabajo;
  }
  return umbralRiesgoRepository.obtenerVigente();
};

const resolverPorSeudonimo = async (idSeudonimo, ts = new Date()) => {
  const operario = await operarioSeudonimoRepository.resolverOperarioPorSeudonimo(idSeudonimo);
  if (!operario) return umbralRiesgoRepository.obtenerVigente();
  return resolverPorOperario(operario.id, ts);
};

module.exports = {
  resolverPorOperario,
  resolverPorSeudonimo,
};
