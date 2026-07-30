/**
 * Tests unitarios del servicio de asociación wearable-trabajador (H0022).
 * Repositorios mockeados (mismo patrón que validacion-datos.service.test.js):
 * acá se cubre la lógica de negocio del acceptance criteria, no la persistencia.
 */

jest.mock('../../src/repositories/operario.repository');
jest.mock('../../src/repositories/dispositivo.repository');
jest.mock('../../src/repositories/asignacionDispositivo.repository');
jest.mock('../../src/repositories/logAuditoria.repository');

const operarioRepository = require('../../src/repositories/operario.repository');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const asignacionRepository = require('../../src/repositories/asignacionDispositivo.repository');
const logAuditoriaRepository = require('../../src/repositories/logAuditoria.repository');
const asociacionesService = require('../../src/services/asociaciones.service');

const actor = { id: 1, ip: '10.0.0.1' };

describe('asociaciones.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logAuditoriaRepository.registrar.mockResolvedValue({ id: 99 });
  });

  describe('crear', () => {
    it('asocia el wearable cuando el trabajador está activo y el wearable está libre', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1, estado: true });
      dispositivoRepository.obtenerPorId.mockResolvedValue({ id: 7 });
      asignacionRepository.obtenerVigentePorDispositivo.mockResolvedValue(undefined);
      asignacionRepository.crear.mockResolvedValue({ id: 55, id_trabajador: 1, id_dispositivo: 7 });

      const resultado = await asociacionesService.crear(
        { idTrabajador: 1, idDispositivo: 7 },
        actor,
      );

      expect(resultado).toMatchObject({ id: 55 });
      expect(logAuditoriaRepository.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ operacion: 'CREATE', idRegistro: 55, tablaAfectada: 'asignacion_dispositivo' }),
      );
    });

    it('rechaza si el trabajador no existe (404)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue(null);

      await expect(
        asociacionesService.crear({ idTrabajador: 999, idDispositivo: 7 }, actor),
      ).rejects.toMatchObject({ status: 404, motivo: 'TRABAJADOR_NO_ENCONTRADO' });
      expect(asignacionRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza si el trabajador está inactivo (criterio: sólo trabajadores activos)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1, estado: false });

      await expect(
        asociacionesService.crear({ idTrabajador: 1, idDispositivo: 7 }, actor),
      ).rejects.toMatchObject({ status: 409, motivo: 'TRABAJADOR_INACTIVO' });
      expect(asignacionRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el wearable ya está asignado a otro trabajador (criterio: no simultáneo)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1, estado: true });
      dispositivoRepository.obtenerPorId.mockResolvedValue({ id: 7 });
      asignacionRepository.obtenerVigentePorDispositivo.mockResolvedValue({ id: 10, id_trabajador: 2 });

      await expect(
        asociacionesService.crear({ idTrabajador: 1, idDispositivo: 7 }, actor),
      ).rejects.toMatchObject({ status: 409, motivo: 'WEARABLE_YA_ASIGNADO' });
      expect(asignacionRepository.crear).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('rechaza si la asociación no existe (404)', async () => {
      asignacionRepository.obtenerPorId.mockResolvedValue(null);

      await expect(
        asociacionesService.actualizar(1, { fechaHasta: null }, actor),
      ).rejects.toMatchObject({ status: 404, motivo: 'ASOCIACION_NO_ENCONTRADA' });
    });

    it('modifica la asociación y audita la operación', async () => {
      asignacionRepository.obtenerPorId.mockResolvedValue({ id: 1, fecha_hasta: null });
      asignacionRepository.actualizar.mockResolvedValue({ id: 1, fecha_hasta: '2026-08-01T00:00:00Z' });

      const resultado = await asociacionesService.actualizar(1, { fechaHasta: '2026-08-01T00:00:00Z' }, actor);

      expect(resultado.fecha_hasta).toBe('2026-08-01T00:00:00Z');
      expect(logAuditoriaRepository.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ operacion: 'UPDATE', idRegistro: 1 }),
      );
    });
  });

  describe('finalizar', () => {
    it('finaliza una asociación vigente y audita la operación', async () => {
      asignacionRepository.obtenerPorId.mockResolvedValue({ id: 1, fecha_hasta: null });
      asignacionRepository.finalizar.mockResolvedValue({ id: 1, fecha_hasta: '2026-07-29T00:00:00Z' });

      const resultado = await asociacionesService.finalizar(1, actor);

      expect(resultado.fecha_hasta).toBe('2026-07-29T00:00:00Z');
      expect(logAuditoriaRepository.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ operacion: 'FINALIZAR', idRegistro: 1 }),
      );
    });

    it('rechaza si ya estaba finalizada (409)', async () => {
      asignacionRepository.obtenerPorId.mockResolvedValue({
        id: 1,
        fecha_hasta: '2020-01-01T00:00:00Z',
      });

      await expect(asociacionesService.finalizar(1, actor)).rejects.toMatchObject({
        status: 409,
        motivo: 'ASOCIACION_YA_FINALIZADA',
      });
      expect(asignacionRepository.finalizar).not.toHaveBeenCalled();
    });
  });
});
