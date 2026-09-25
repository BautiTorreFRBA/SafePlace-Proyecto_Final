/**
 * Tests unitarios de la resolución del umbral efectivo: global para todos,
 * salvo la FC de fatiga/sobreesfuerzo de los operarios con Configuración
 * particular (operario."FC_Fatiga" / "FC_Sobreesfuerzo"). Repositorios mockeados.
 */

jest.mock('../../src/repositories/operarioSeudonimo.repository');
jest.mock('../../src/repositories/umbralOperario.repository');
jest.mock('../../src/repositories/umbralRiesgo.repository');

const operarioSeudonimoRepository = require('../../src/repositories/operarioSeudonimo.repository');
const umbralOperarioRepository = require('../../src/repositories/umbralOperario.repository');
const umbralRiesgoRepository = require('../../src/repositories/umbralRiesgo.repository');
const umbralEfectivoService = require('../../src/services/umbralEfectivo.service');

const GLOBAL = {
  id: 1,
  fc_fatiga: 140,
  minutos_fatiga: 10,
  fc_sobreesfuerzo: 170,
  actividad_sobreesfuerzo: 0.8,
  minutos_inactividad: 30,
  minutos_desconexion_tolerada: 10,
};

describe('umbralEfectivo.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    umbralRiesgoRepository.obtenerVigente.mockResolvedValue(GLOBAL);
    operarioSeudonimoRepository.resolverOperarioPorSeudonimo.mockResolvedValue({ id: 5 });
  });

  it('usa el umbral global si el operario no tiene configuración particular', async () => {
    umbralOperarioRepository.obtenerPorOperario.mockResolvedValue(undefined);

    await expect(umbralEfectivoService.resolverPorSeudonimo(7)).resolves.toEqual(GLOBAL);
    expect(umbralOperarioRepository.obtenerPorOperario).toHaveBeenCalledWith(5);
  });

  it('reemplaza sólo las dos FC cuando hay configuración particular', async () => {
    umbralOperarioRepository.obtenerPorOperario.mockResolvedValue({ id_operario: 5, fc_fatiga: 120, fc_sobreesfuerzo: 150 });

    await expect(umbralEfectivoService.resolverPorSeudonimo(7)).resolves.toEqual({
      ...GLOBAL,
      fc_fatiga: 120,
      fc_sobreesfuerzo: 150,
    });
  });

  it('una FC particular en NULL cae a la global', async () => {
    umbralOperarioRepository.obtenerPorOperario.mockResolvedValue({ id_operario: 5, fc_fatiga: 120, fc_sobreesfuerzo: null });

    await expect(umbralEfectivoService.resolverPorSeudonimo(7)).resolves.toEqual({
      ...GLOBAL,
      fc_fatiga: 120,
    });
  });

  it('sin umbral global no evalúa, aunque haya configuración particular', async () => {
    umbralRiesgoRepository.obtenerVigente.mockResolvedValue(undefined);
    umbralOperarioRepository.obtenerPorOperario.mockResolvedValue({ id_operario: 5, fc_fatiga: 120, fc_sobreesfuerzo: 150 });

    await expect(umbralEfectivoService.resolverPorSeudonimo(7)).resolves.toBeUndefined();
  });

  it('seudónimo sin operario → umbral global', async () => {
    operarioSeudonimoRepository.resolverOperarioPorSeudonimo.mockResolvedValue(undefined);

    await expect(umbralEfectivoService.resolverPorSeudonimo(7)).resolves.toEqual(GLOBAL);
    expect(umbralOperarioRepository.obtenerPorOperario).not.toHaveBeenCalled();
  });
});
