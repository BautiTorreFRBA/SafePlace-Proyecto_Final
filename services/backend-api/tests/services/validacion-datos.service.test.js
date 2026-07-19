/**
 * Tests unitarios del Servicio de Validación de Datos (RF-04 / H0008 / CP-VAL-001).
 *
 * Cubren los 6 escenarios de aceptación:
 *   1. paquete válido            -> aceptado, pasa a almacenamiento
 *   2. campos incompletos        -> descartado y auditado
 *   3. BPM fuera de rango        -> descartado y auditado
 *   4. estructura corrupta/tipos -> descartado y auditado
 *   5. registro duplicado        -> descartado y auditado
 *   6. sin consentimiento        -> descartado EN MEMORIA (sin persistir ni auditar)
 *
 * Los repositorios están mockeados: acá se verifica la lógica de validación y
 * orquestación en aislamiento; la persistencia real se cubre en
 * tests/integration/mediciones.ingesta.test.js.
 */

jest.mock('../../src/repositories/medicion.repository');
jest.mock('../../src/repositories/asignacionDispositivo.repository');
jest.mock('../../src/repositories/registroConsentimiento.repository');
jest.mock('../../src/repositories/logAuditoria.repository');

const medicionRepository = require('../../src/repositories/medicion.repository');
const asignacionDispositivoRepository = require('../../src/repositories/asignacionDispositivo.repository');
const registroConsentimientoRepository = require('../../src/repositories/registroConsentimiento.repository');
const logAuditoriaRepository = require('../../src/repositories/logAuditoria.repository');
const consentimientoCache = require('../../src/services/validacion/consentimiento.cache');
const medicionesService = require('../../src/services/mediciones.service');
const { ErrorValidacion, MOTIVOS } = require('../../src/services/validacion/errores');

const paqueteValido = (overrides = {}) => ({
  idDispositivo: 7,
  timestamp: '2026-07-18T12:00:00.000Z',
  frecuenciaCardiaca: 88,
  nivelActividad: 0.5,
  nivelInactividad: 0,
  ...overrides,
});

const esperarDescarte = async (paquete, motivoEsperado) => {
  let capturado;
  try {
    await medicionesService.registrarMedicion(paquete, { ipOrigen: '10.0.0.1' });
  } catch (err) {
    capturado = err;
  }
  expect(capturado).toBeInstanceOf(ErrorValidacion);
  expect(capturado.motivo).toBe(motivoEsperado);
  return capturado;
};

describe('Servicio de Validación de Datos (unitario)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consentimientoCache.limpiar();

    // Estado por defecto: wearable asignado, consentimiento otorgado, sin duplicados.
    asignacionDispositivoRepository.obtenerVigentePorDispositivo.mockResolvedValue({
      id: 1,
      id_trabajador: 42,
      id_dispositivo: 7,
    });
    registroConsentimientoRepository.obtenerVigente.mockResolvedValue({
      id: 1,
      id_trabajador: 42,
      estado: true,
      version_politica: 'v1.0',
    });
    medicionRepository.existeDuplicado.mockResolvedValue(false);
    medicionRepository.crear.mockImplementation(async (data) => ({ id: 99, ...data }));
    logAuditoriaRepository.registrar.mockResolvedValue({ id: 1 });
  });

  it('1. paquete válido: acepta, normaliza y lo pasa al almacenamiento', async () => {
    const resultado = await medicionesService.registrarMedicion(paqueteValido());

    expect(resultado.id).toBe(99);
    expect(medicionRepository.crear).toHaveBeenCalledTimes(1);

    const medicion = medicionRepository.crear.mock.calls[0][0];
    // idTrabajador resuelto desde la asignación vigente, no confiado del gateway
    expect(medicion.idTrabajador).toBe(42);
    expect(medicion.idDispositivo).toBe(7);
    // fechaHora oficial la asigna el backend (RF-03); la captura se conserva aparte
    expect(medicion.fechaHora).toBeInstanceOf(Date);
    expect(medicion.fechaHoraCaptura).toEqual(new Date('2026-07-18T12:00:00.000Z'));
    expect(medicion.frecuenciaCardiaca).toBe(88);

    expect(logAuditoriaRepository.registrar).not.toHaveBeenCalled();
  });

  it('2. campos incompletos (sin idDispositivo): descartado y auditado', async () => {
    const { idDispositivo, ...sinId } = paqueteValido();
    await esperarDescarte(sinId, MOTIVOS.CAMPOS_INCOMPLETOS);

    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).toHaveBeenCalledTimes(1);
    const auditoria = logAuditoriaRepository.registrar.mock.calls[0][0];
    expect(auditoria.operacion).toBe('DESCARTE_VALIDACION');
    expect(JSON.parse(auditoria.detalle)).toMatchObject({ motivo: MOTIVOS.CAMPOS_INCOMPLETOS });
  });

  it('2b. campos incompletos (sin timestamp / sin frecuenciaCardiaca): descartado y auditado', async () => {
    const { timestamp, ...sinTimestamp } = paqueteValido();
    await esperarDescarte(sinTimestamp, MOTIVOS.CAMPOS_INCOMPLETOS);

    const { frecuenciaCardiaca, ...sinFc } = paqueteValido();
    await esperarDescarte(sinFc, MOTIVOS.CAMPOS_INCOMPLETOS);

    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).toHaveBeenCalledTimes(2);
  });

  it('3. frecuencia cardíaca fuera del rango 30-220 BPM: descartado y auditado', async () => {
    await esperarDescarte(paqueteValido({ frecuenciaCardiaca: 29 }), MOTIVOS.FUERA_DE_RANGO);
    await esperarDescarte(paqueteValido({ frecuenciaCardiaca: 221 }), MOTIVOS.FUERA_DE_RANGO);

    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).toHaveBeenCalledTimes(2);

    // Los límites son inclusivos: 30 y 220 BPM son válidos
    await expect(medicionesService.registrarMedicion(paqueteValido({ frecuenciaCardiaca: 30 })))
      .resolves.toBeDefined();
    await expect(
      medicionesService.registrarMedicion(paqueteValido({ frecuenciaCardiaca: 220, timestamp: '2026-07-18T12:00:01.000Z' })),
    ).resolves.toBeDefined();
  });

  it('4. estructura corrupta (tipos incorrectos): descartado y auditado', async () => {
    await esperarDescarte(paqueteValido({ frecuenciaCardiaca: 'ochenta' }), MOTIVOS.ESTRUCTURA_INVALIDA);
    await esperarDescarte(paqueteValido({ timestamp: 'no-es-una-fecha' }), MOTIVOS.ESTRUCTURA_INVALIDA);
    await esperarDescarte([1, 2, 3], MOTIVOS.ESTRUCTURA_INVALIDA);

    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).toHaveBeenCalledTimes(3);
  });

  it('5. registro duplicado (mismo wearable + misma captura): descartado y auditado con 409', async () => {
    medicionRepository.existeDuplicado.mockResolvedValue(true);

    const error = await esperarDescarte(paqueteValido(), MOTIVOS.DUPLICADO);
    expect(error.status).toBe(409);
    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).toHaveBeenCalledTimes(1);
  });

  it('5b. duplicado por carrera (el índice único lo frena en el INSERT): descartado y auditado', async () => {
    medicionRepository.existeDuplicado.mockResolvedValue(false);
    medicionRepository.crear.mockResolvedValue(undefined); // ON CONFLICT DO NOTHING

    const error = await esperarDescarte(paqueteValido(), MOTIVOS.DUPLICADO);
    expect(error.status).toBe(409);
    expect(logAuditoriaRepository.registrar).toHaveBeenCalledTimes(1);
  });

  it('6. consentimiento revocado: descartado en memoria, sin persistir NI auditar el biodato', async () => {
    registroConsentimientoRepository.obtenerVigente.mockResolvedValue({
      id: 2,
      id_trabajador: 42,
      estado: false,
      version_politica: 'v1.0',
    });

    let capturado;
    try {
      await medicionesService.registrarMedicion(paqueteValido());
    } catch (err) {
      capturado = err;
    }
    expect(capturado).toBeInstanceOf(ErrorValidacion);
    expect(capturado.motivo).toBe(MOTIVOS.SIN_CONSENTIMIENTO);
    expect(capturado.status).toBe(403);

    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).not.toHaveBeenCalled();
  });

  it('6b. consentimiento inexistente: mismo tratamiento que revocado', async () => {
    registroConsentimientoRepository.obtenerVigente.mockResolvedValue(undefined);

    await expect(medicionesService.registrarMedicion(paqueteValido())).rejects.toMatchObject({
      motivo: MOTIVOS.SIN_CONSENTIMIENTO,
    });
    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).not.toHaveBeenCalled();
  });

  it('wearable inexistente o sin trabajador asignado: descartado y auditado', async () => {
    asignacionDispositivoRepository.obtenerVigentePorDispositivo.mockResolvedValue(undefined);

    await esperarDescarte(paqueteValido(), MOTIVOS.DISPOSITIVO_INVALIDO);
    expect(medicionRepository.crear).not.toHaveBeenCalled();
    expect(logAuditoriaRepository.registrar).toHaveBeenCalledTimes(1);
  });

  it('la auditoría de descartes minimiza datos: hash del paquete, sin valor biométrico ni idTrabajador', async () => {
    await esperarDescarte(paqueteValido({ frecuenciaCardiaca: 300 }), MOTIVOS.FUERA_DE_RANGO);

    const auditoria = logAuditoriaRepository.registrar.mock.calls[0][0];
    const detalle = JSON.parse(auditoria.detalle);
    expect(detalle.hashPaquete).toMatch(/^[a-f0-9]{64}$/);
    expect(detalle.idDispositivo).toBe(7);
    expect(auditoria.detalle).not.toContain('300'); // el valor biométrico no viaja al log
    expect(detalle.idTrabajador).toBeUndefined();
  });

  it('el flag de consentimiento se cachea (RNF-09): una sola consulta por trabajador dentro del TTL', async () => {
    await medicionesService.registrarMedicion(paqueteValido());
    await medicionesService.registrarMedicion(paqueteValido({ timestamp: '2026-07-18T12:00:01.000Z' }));

    expect(registroConsentimientoRepository.obtenerVigente).toHaveBeenCalledTimes(1);
  });
});
