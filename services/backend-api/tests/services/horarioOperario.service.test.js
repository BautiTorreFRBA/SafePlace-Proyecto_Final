/**
 * Unitarios de horarioOperario.service — validación de ventanas, incluida
 * la nueva regla de múltiples ventanas por día sin superposición horaria.
 * Repositorios mockeados.
 */

jest.mock('../../src/repositories/horarioOperario.repository');
jest.mock('../../src/repositories/operario.repository');
jest.mock('../../src/repositories/logAuditoria.repository');

const horarioOperarioRepository = require('../../src/repositories/horarioOperario.repository');
const operarioRepository = require('../../src/repositories/operario.repository');
const logAuditoriaRepository = require('../../src/repositories/logAuditoria.repository');
const horarioOperarioService = require('../../src/services/horarioOperario.service');

const ventana = (overrides = {}) => ({ diaSemana: 1, horaInicio: '08:00', horaFin: '12:00', ...overrides });

describe('horarioOperario.service.configurar — múltiples ventanas por día', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    operarioRepository.obtenerPorId.mockResolvedValue({ id: 1 });
    horarioOperarioRepository.reemplazar.mockResolvedValue([]);
    logAuditoriaRepository.registrar.mockResolvedValue({ id: 1 });
  });

  it('acepta dos ventanas no superpuestas el mismo día (turno partido)', async () => {
    await expect(horarioOperarioService.configurar(1, [
      ventana({ horaInicio: '08:00', horaFin: '12:00' }),
      ventana({ horaInicio: '13:00', horaFin: '17:00' }),
    ], {})).resolves.toEqual([]);

    expect(horarioOperarioRepository.reemplazar).toHaveBeenCalledWith(1, expect.arrayContaining([
      expect.objectContaining({ horaInicio: '08:00' }),
      expect.objectContaining({ horaInicio: '13:00' }),
    ]));
  });

  it('acepta ventanas contiguas (una termina justo cuando empieza la otra)', async () => {
    await expect(horarioOperarioService.configurar(1, [
      ventana({ horaInicio: '08:00', horaFin: '12:00' }),
      ventana({ horaInicio: '12:00', horaFin: '17:00' }),
    ], {})).resolves.toEqual([]);
  });

  it('rechaza dos ventanas superpuestas el mismo día', async () => {
    await expect(horarioOperarioService.configurar(1, [
      ventana({ horaInicio: '08:00', horaFin: '13:00' }),
      ventana({ horaInicio: '12:00', horaFin: '17:00' }),
    ], {})).rejects.toMatchObject({ motivo: 'HORARIO_INVALIDO' });

    expect(horarioOperarioRepository.reemplazar).not.toHaveBeenCalled();
  });

  it('permite ventanas superpuestas en horario si son de días distintos', async () => {
    await expect(horarioOperarioService.configurar(1, [
      ventana({ diaSemana: 1, horaInicio: '08:00', horaFin: '17:00' }),
      ventana({ diaSemana: 2, horaInicio: '08:00', horaFin: '17:00' }),
    ], {})).resolves.toEqual([]);
  });

  it('sigue rechazando horaFin <= horaInicio', async () => {
    await expect(horarioOperarioService.configurar(1, [
      ventana({ horaInicio: '12:00', horaFin: '12:00' }),
    ], {})).rejects.toMatchObject({ motivo: 'HORARIO_INVALIDO' });
  });

  it('propaga idTrabajo por ventana al repositorio', async () => {
    await horarioOperarioService.configurar(1, [
      ventana({ idTrabajo: 5 }),
    ], {});

    expect(horarioOperarioRepository.reemplazar).toHaveBeenCalledWith(1, [
      expect.objectContaining({ idTrabajo: 5 }),
    ]);
  });
});

describe('horarioOperario.service — excepciones puntuales por fecha', () => {
  const excepcionExistente = (overrides = {}) => ({
    id: 1, fecha: '2026-09-20', hora_inicio: '08:00:00', hora_fin: '12:00:00', ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    operarioRepository.obtenerPorId.mockResolvedValue({ id: 1 });
    horarioOperarioRepository.listarExcepcionesPorOperario.mockResolvedValue([]);
    horarioOperarioRepository.agregarExcepcion.mockResolvedValue({ id: 10 });
    horarioOperarioRepository.eliminarExcepcion.mockResolvedValue(true);
    logAuditoriaRepository.registrar.mockResolvedValue({ id: 1 });
  });

  it('agrega una excepción válida', async () => {
    await expect(horarioOperarioService.agregarExcepcion(1, {
      fecha: '2026-09-20', horaInicio: '08:00', horaFin: '12:00', idTrabajo: null,
    }, {})).resolves.toEqual({ id: 10 });

    expect(horarioOperarioRepository.agregarExcepcion).toHaveBeenCalledWith(1, expect.objectContaining({
      fecha: '2026-09-20', horaInicio: '08:00', horaFin: '12:00',
    }));
  });

  it('rechaza fecha con formato inválido', async () => {
    await expect(horarioOperarioService.agregarExcepcion(1, {
      fecha: '20-09-2026', horaInicio: '08:00', horaFin: '12:00',
    }, {})).rejects.toMatchObject({ motivo: 'HORARIO_INVALIDO' });
  });

  it('rechaza superposición con otra excepción de la MISMA fecha', async () => {
    horarioOperarioRepository.listarExcepcionesPorOperario.mockResolvedValue([excepcionExistente()]);

    await expect(horarioOperarioService.agregarExcepcion(1, {
      fecha: '2026-09-20', horaInicio: '10:00', horaFin: '14:00',
    }, {})).rejects.toMatchObject({ motivo: 'HORARIO_INVALIDO' });

    expect(horarioOperarioRepository.agregarExcepcion).not.toHaveBeenCalled();
  });

  it('NO exige evitar superposición con otra fecha distinta', async () => {
    horarioOperarioRepository.listarExcepcionesPorOperario.mockResolvedValue([excepcionExistente({ fecha: '2026-09-21' })]);

    await expect(horarioOperarioService.agregarExcepcion(1, {
      fecha: '2026-09-20', horaInicio: '10:00', horaFin: '14:00',
    }, {})).resolves.toEqual({ id: 10 });
  });

  it('eliminarExcepcion propaga 404 si el repositorio no encontró/borró nada', async () => {
    horarioOperarioRepository.eliminarExcepcion.mockResolvedValue(false);

    await expect(horarioOperarioService.eliminarExcepcion(1, 999, {}))
      .rejects.toMatchObject({ status: 404, motivo: 'EXCEPCION_NO_ENCONTRADA' });
  });
});
