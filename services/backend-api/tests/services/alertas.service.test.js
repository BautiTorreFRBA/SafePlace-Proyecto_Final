/**
 * Tests unitarios de la escalada a EMERGENCIA ("super alerta") en
 * alertas.service.generar. Repositorios mockeados.
 */

jest.mock('../../src/repositories/tipoAlerta.repository');
jest.mock('../../src/repositories/alerta.repository');
jest.mock('../../src/repositories/notificacion.repository');
jest.mock('../../src/repositories/logAuditoria.repository');

const tipoAlertaRepository = require('../../src/repositories/tipoAlerta.repository');
const alertaRepository = require('../../src/repositories/alerta.repository');
const notificacionRepository = require('../../src/repositories/notificacion.repository');
const logAuditoriaRepository = require('../../src/repositories/logAuditoria.repository');
const alertasService = require('../../src/services/alertas.service');

const TIPOS_MOCK = {
  FATIGA: { id: 1, nombre: 'FATIGA', prioridad: 'Media' },
  SOBREESFUERZO: { id: 2, nombre: 'SOBREESFUERZO', prioridad: 'Crítica' },
  INACTIVIDAD_PROLONGADA: { id: 3, nombre: 'INACTIVIDAD_PROLONGADA', prioridad: 'Media' },
  EMERGENCIA: { id: 4, nombre: 'EMERGENCIA', prioridad: 'Crítica' },
};

const crearConTipo = (idTipoAlerta) => expect.objectContaining({ idTipoAlerta });

describe('alertas.service — escalada a EMERGENCIA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tipoAlertaRepository.obtenerPorNombre.mockImplementation(async (nombre) => TIPOS_MOCK[nombre]);
    alertaRepository.existeActivaParaSeudonimoYTipo.mockResolvedValue(false);
    alertaRepository.crear.mockResolvedValue({ id: 900 });
    alertaRepository.listarTiposEnVentana.mockResolvedValue([]);
    notificacionRepository.crear.mockResolvedValue({ id: 901 });
    logAuditoriaRepository.registrar.mockResolvedValue({ id: 1 });
  });

  it('inactividad prolongada después de fatiga en la ventana genera EMERGENCIA', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['FATIGA', 'INACTIVIDAD_PROLONGADA']);

    await alertasService.generar({ nombreTipo: 'INACTIVIDAD_PROLONGADA', idSeudonimo: 7 });

    expect(alertaRepository.crear).toHaveBeenCalledTimes(2);
    expect(alertaRepository.crear).toHaveBeenLastCalledWith(
      expect.objectContaining({ idTipoAlerta: 4, idMedicion: null, idSeudonimo: 7 }),
    );
    expect(notificacionRepository.crear).toHaveBeenCalledTimes(2);
  });

  it('inactividad prolongada después de sobreesfuerzo en la ventana genera EMERGENCIA', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['SOBREESFUERZO', 'INACTIVIDAD_PROLONGADA']);

    await alertasService.generar({ nombreTipo: 'INACTIVIDAD_PROLONGADA', idSeudonimo: 7 });

    expect(alertaRepository.crear).toHaveBeenLastCalledWith(crearConTipo(4));
  });

  it('inactividad prolongada sola (sin fatiga/sobreesfuerzo previo) no escala', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['INACTIVIDAD_PROLONGADA']);

    await alertasService.generar({ nombreTipo: 'INACTIVIDAD_PROLONGADA', idSeudonimo: 7 });

    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
  });

  it('fatiga después de inactividad no escala por secuencia (el orden importa)', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['INACTIVIDAD_PROLONGADA', 'FATIGA']);

    await alertasService.generar({ nombreTipo: 'FATIGA', idSeudonimo: 7 });

    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
  });

  it('3 alertas en la ventana (incluida la nueva) generan EMERGENCIA', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['FATIGA', 'FATIGA', 'SOBREESFUERZO']);

    await alertasService.generar({ nombreTipo: 'SOBREESFUERZO', idSeudonimo: 7, idMedicion: 500 });

    expect(alertaRepository.crear).toHaveBeenCalledTimes(2);
    expect(alertaRepository.crear).toHaveBeenLastCalledWith(crearConTipo(4));
  });

  it('2 alertas en la ventana no escalan', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['FATIGA', 'FATIGA']);

    await alertasService.generar({ nombreTipo: 'FATIGA', idSeudonimo: 7 });

    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
  });

  it('las EMERGENCIA previas no cuentan para la reincidencia', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['FATIGA', 'FATIGA', 'EMERGENCIA']);

    await alertasService.generar({ nombreTipo: 'FATIGA', idSeudonimo: 7 });

    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
  });

  it('antiduplicado: con una EMERGENCIA ya activa no crea otra', async () => {
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['FATIGA', 'FATIGA', 'FATIGA']);
    alertaRepository.existeActivaParaSeudonimoYTipo.mockImplementation(
      async (idSeudonimo, idTipo) => idTipo === 4,
    );

    await alertasService.generar({ nombreTipo: 'FATIGA', idSeudonimo: 7 });

    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
    expect(alertaRepository.crear).toHaveBeenCalledWith(crearConTipo(1));
  });

  it('generar EMERGENCIA no vuelve a evaluar la escalada (sin recursión)', async () => {
    await alertasService.generar({ nombreTipo: 'EMERGENCIA', idSeudonimo: 7 });

    expect(alertaRepository.listarTiposEnVentana).not.toHaveBeenCalled();
    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
  });

  it('si falla la consulta de la ventana, la alerta original igual se devuelve', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    alertaRepository.listarTiposEnVentana.mockRejectedValue(new Error('db caída'));

    const alerta = await alertasService.generar({ nombreTipo: 'FATIGA', idSeudonimo: 7 });

    expect(alerta).toEqual({ id: 900 });
    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('si el tipo EMERGENCIA no existe en el catálogo (migración sin correr), no rompe', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    alertaRepository.listarTiposEnVentana.mockResolvedValue(['FATIGA', 'FATIGA', 'FATIGA']);
    tipoAlertaRepository.obtenerPorNombre.mockImplementation(
      async (nombre) => (nombre === 'EMERGENCIA' ? undefined : TIPOS_MOCK[nombre]),
    );

    const alerta = await alertasService.generar({ nombreTipo: 'FATIGA', idSeudonimo: 7 });

    expect(alerta).toEqual({ id: 900 });
    expect(alertaRepository.crear).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
