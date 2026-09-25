const operarioSeudonimoRepository = require('../repositories/operarioSeudonimo.repository');
const umbralOperarioRepository = require('../repositories/umbralOperario.repository');
const umbralRiesgoRepository = require('../repositories/umbralRiesgo.repository');

/**
 * Resuelve qué umbral de riesgo aplica a un operario: el umbral_riesgo global
 * vigente (Configuración Operativa) para todos, salvo los operarios con
 * "Configuración particular" (umbral_operario), a los que se les reemplazan
 * sólo la FC de fatiga y la de sobreesfuerzo. Minutos sostenidos, actividad
 * mínima e inactividad siguen siendo los globales.
 *
 * Los `trabajo` por ventana de horario ya no intervienen en la FC: la
 * Configuración particular los reemplazó en la pantalla de configuración.
 *
 * `ts` se conserva en la firma porque lo pasa el Motor de Reglas; hoy la
 * configuración particular no depende del instante.
 */

const resolverPorOperario = async (idOperario, ts = new Date()) => { // eslint-disable-line no-unused-vars
  const [global, particular] = await Promise.all([
    umbralRiesgoRepository.obtenerVigente(),
    umbralOperarioRepository.obtenerPorOperario(idOperario),
  ]);
  // Sin umbral global (H0023 nunca corrido) no hay minutos/actividad contra
  // los cuales evaluar: se mantiene el comportamiento de "no evaluar".
  if (!global || !particular) return global;
  return {
    ...global,
    fc_fatiga: particular.fc_fatiga,
    fc_sobreesfuerzo: particular.fc_sobreesfuerzo,
  };
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
