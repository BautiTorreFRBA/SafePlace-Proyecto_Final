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
