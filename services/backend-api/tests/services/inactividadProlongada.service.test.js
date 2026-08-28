/**
 * Tests unitarios de inactividadProlongada.service (CP-E2E-04 / H0012
 * reencuadrada). Repositorios mockeados; el camino end-to-end contra
 * Postgres real está en tests/integration/inactividadProlongada.test.js.
 */

jest.mock('../../src/repositories/historialEstadoDispositivo.repository');
jest.mock('../../src/repositories/horarioOperario.repository');
jest.mock('../../src/repositories/umbralRiesgo.repository');
jest.mock('../../src/repositories/operarioSeudonimo.repository');
jest.mock('../../src/repositories/tipoAlerta.repository');
jest.mock('../../src/repositories/alerta.repository');
jest.mock('../../src/services/alertas.service');

const historialEstadoDispositivoRepository = require('../../src/repositories/historialEstadoDispositivo.repository');
const horarioOperarioRepository = require('../../src/repositories/horarioOperario.repository');
const umbralRiesgoRepository = require('../../src/repositories/umbralRiesgo.repository');
const operarioSeudonimoRepository = require('../../src/repositories/operarioSeudonimo.repository');
const tipoAlertaRepository = require('../../src/repositories/tipoAlerta.repository');
const alertaRepository = require('../../src/repositories/alerta.repository');
const alertasService = require('../../src/services/alertas.service');
const inactividadProlongadaService = require('../../src/services/inactividadProlongada.service');

const candidato = (overrides = {}) => ({
  id_dispositivo: 3,
  id_operario: 42,
  desconectado_desde: new Date(Date.now() - 20 * 60 * 1000),
  ...overrides,
});

describe('inactividadProlongada.service.chequear (CP-E2E-04)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    umbralRiesgoRepository.obtenerVigente.mockResolvedValue({ minutos_desconexion_tolerada: 10 });
    historialEstadoDispositivoRepository.listarDesconectadosParaAlerta.mockResolvedValue([candidato()]);
    horarioOperarioRepository.estaDentroDeHorario.mockResolvedValue(true);
    operarioSeudonimoRepository.obtenerOCrearPorOperario.mockResolvedValue({ id: 7 });
    alertasService.generar.mockResolvedValue({ id: 900 });
  });

  it('desconectado > tolerancia y dentro de horario laboral: genera la alerta', async () => {
    const n = await inactividadProlongadaService.chequear();

    expect(n).toBe(1);
    expect(alertasService.generar).toHaveBeenCalledWith(
      expect.objectContaining({ nombreTipo: 'INACTIVIDAD_PROLONGADA', idSeudonimo: 7, idMedicion: null }),
    );
  });

  it('fuera del horario laboral: NO genera alerta', async () => {
    horarioOperarioRepository.estaDentroDeHorario.mockResolvedValue(false);

    const n = await inactividadProlongadaService.chequear();

    expect(n).toBe(0);
    expect(alertasService.generar).not.toHaveBeenCalled();
  });

  it('sin tolerancia configurada (umbral vacío): no hace nada', async () => {
    umbralRiesgoRepository.obtenerVigente.mockResolvedValue(undefined);

    const n = await inactividadProlongadaService.chequear();

    expect(n).toBe(0);
    expect(historialEstadoDispositivoRepository.listarDesconectadosParaAlerta).not.toHaveBeenCalled();
  });

  it('sin dispositivos desconectados el tiempo suficiente: no genera nada', async () => {
    historialEstadoDispositivoRepository.listarDesconectadosParaAlerta.mockResolvedValue([]);

    const n = await inactividadProlongadaService.chequear();

    expect(n).toBe(0);
    expect(alertasService.generar).not.toHaveBeenCalled();
  });

  it('antiduplicado: si alertas.service no crea (ya hay una Activa), no cuenta', async () => {
    alertasService.generar.mockResolvedValue(null);

    const n = await inactividadProlongadaService.chequear();

    expect(n).toBe(0);
  });

  it('resolverPorReconexion cierra las alertas Activas del tipo para el operario', async () => {
    operarioSeudonimoRepository.obtenerPorOperario.mockResolvedValue({ id: 7 });
    tipoAlertaRepository.obtenerPorNombre.mockResolvedValue({ id: 3 });
    alertaRepository.cerrarActivasPorSeudonimoYTipo.mockResolvedValue([{ id: 900 }]);

    const cerradas = await inactividadProlongadaService.resolverPorReconexion(42);

    expect(alertaRepository.cerrarActivasPorSeudonimoYTipo).toHaveBeenCalledWith(7, 3);
    expect(cerradas).toHaveLength(1);
  });

  it('resolverPorReconexion sin seudónimo (operario nunca midió): no rompe', async () => {
    operarioSeudonimoRepository.obtenerPorOperario.mockResolvedValue(undefined);

    await expect(inactividadProlongadaService.resolverPorReconexion(99)).resolves.toEqual([]);
  });
});
