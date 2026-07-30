/**
 * Tests unitarios del servicio de consentimiento del trabajador (H0019).
 * Repositorios y caché mockeados: acá se cubre la lógica de negocio del
 * acceptance criteria, no la persistencia.
 */

jest.mock('../../src/repositories/operario.repository');
jest.mock('../../src/repositories/registroConsentimiento.repository');
jest.mock('../../src/repositories/logAuditoria.repository');
jest.mock('../../src/services/validacion/consentimiento.cache');

const operarioRepository = require('../../src/repositories/operario.repository');
const registroConsentimientoRepository = require('../../src/repositories/registroConsentimiento.repository');
const logAuditoriaRepository = require('../../src/repositories/logAuditoria.repository');
const consentimientoCache = require('../../src/services/validacion/consentimiento.cache');
const consentimientoService = require('../../src/services/consentimiento.service');

const actor = { id: 1, ip: '10.0.0.1' };

describe('consentimiento.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logAuditoriaRepository.registrar.mockResolvedValue({ id: 99 });
  });

  describe('otorgar', () => {
    it('registra el otorgamiento, invalida la caché y audita la operación', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1, estado: true });
      registroConsentimientoRepository.crear.mockResolvedValue({
        id: 10,
        id_operario: 1,
        estado: true,
        version_politica: 'v1',
      });

      const resultado = await consentimientoService.otorgar(
        { idTrabajador: 1, versionPolitica: 'v1' },
        actor,
      );

      expect(resultado).toMatchObject({ id: 10 });
      expect(registroConsentimientoRepository.crear).toHaveBeenCalledWith({
        idOperario: 1,
        estado: true,
        versionPolitica: 'v1',
      });
      expect(consentimientoCache.invalidar).toHaveBeenCalledWith(1);
      expect(logAuditoriaRepository.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          operacion: 'OTORGAR',
          idRegistro: 10,
          tablaAfectada: 'registro_consentimiento',
        }),
      );
    });

    it('rechaza si falta versionPolitica (400)', async () => {
      await expect(
        consentimientoService.otorgar({ idTrabajador: 1 }, actor),
      ).rejects.toMatchObject({ status: 400, motivo: 'VALIDACION_DATOS' });
      expect(registroConsentimientoRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza si el trabajador no existe (404)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue(null);

      await expect(
        consentimientoService.otorgar({ idTrabajador: 999, versionPolitica: 'v1' }, actor),
      ).rejects.toMatchObject({ status: 404, motivo: 'TRABAJADOR_NO_ENCONTRADO' });
      expect(registroConsentimientoRepository.crear).not.toHaveBeenCalled();
    });
  });

  describe('revocar', () => {
    it('registra la revocación reutilizando la versión de política vigente', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1, estado: true });
      registroConsentimientoRepository.obtenerVigente.mockResolvedValue({
        id: 10,
        estado: true,
        version_politica: 'v1',
      });
      registroConsentimientoRepository.crear.mockResolvedValue({
        id: 11,
        id_operario: 1,
        estado: false,
        version_politica: 'v1',
      });

      const resultado = await consentimientoService.revocar(1, actor);

      expect(resultado).toMatchObject({ id: 11, estado: false });
      expect(registroConsentimientoRepository.crear).toHaveBeenCalledWith({
        idOperario: 1,
        estado: false,
        versionPolitica: 'v1',
      });
      expect(consentimientoCache.invalidar).toHaveBeenCalledWith(1);
      expect(logAuditoriaRepository.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ operacion: 'REVOCAR', idRegistro: 11 }),
      );
    });

    it('rechaza si el trabajador no existe (404)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue(null);

      await expect(consentimientoService.revocar(999, actor)).rejects.toMatchObject({
        status: 404,
        motivo: 'TRABAJADOR_NO_ENCONTRADO',
      });
    });

    it('rechaza si no hay consentimiento vigente para revocar (409)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1, estado: true });
      registroConsentimientoRepository.obtenerVigente.mockResolvedValue(undefined);

      await expect(consentimientoService.revocar(1, actor)).rejects.toMatchObject({
        status: 409,
        motivo: 'CONSENTIMIENTO_NO_VIGENTE',
      });
      expect(registroConsentimientoRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza si el consentimiento vigente ya está revocado (409)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1, estado: true });
      registroConsentimientoRepository.obtenerVigente.mockResolvedValue({
        id: 10,
        estado: false,
        version_politica: 'v1',
      });

      await expect(consentimientoService.revocar(1, actor)).rejects.toMatchObject({
        status: 409,
        motivo: 'CONSENTIMIENTO_NO_VIGENTE',
      });
      expect(registroConsentimientoRepository.crear).not.toHaveBeenCalled();
    });
  });

  describe('obtenerHistorial', () => {
    it('devuelve el historial del trabajador', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue({ id: 1 });
      registroConsentimientoRepository.listarPorTrabajador.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const resultado = await consentimientoService.obtenerHistorial(1);

      expect(resultado).toHaveLength(2);
    });

    it('rechaza si el trabajador no existe (404)', async () => {
      operarioRepository.obtenerPorId.mockResolvedValue(null);

      await expect(consentimientoService.obtenerHistorial(999)).rejects.toMatchObject({
        status: 404,
        motivo: 'TRABAJADOR_NO_ENCONTRADO',
      });
    });
  });
});
