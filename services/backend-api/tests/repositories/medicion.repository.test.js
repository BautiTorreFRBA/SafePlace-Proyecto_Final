const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const { empresaMock, trabajadorMock, dispositivoMock, medicionMock } = require('../fixtures/mockEntities');
const empresaRepository = require('../../src/repositories/empresa.repository');
const trabajadorRepository = require('../../src/repositories/trabajador.repository');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const medicionRepository = require('../../src/repositories/medicion.repository');
const asignacionDispositivoRepository = require('../../src/repositories/asignacionDispositivo.repository');
const registroConsentimientoRepository = require('../../src/repositories/registroConsentimiento.repository');
const consentimientoCache = require('../../src/services/validacion/consentimiento.cache');
const medicionesService = require('../../src/services/mediciones.service');

describe('medicion.repository', () => {
  let trabajador;
  let dispositivo;

  beforeEach(async () => {
    await truncarTodo();
    const empresa = await empresaRepository.crear(empresaMock());
    trabajador = await trabajadorRepository.crear(trabajadorMock(empresa.id));
    dispositivo = await dispositivoRepository.crear(dispositivoMock());
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('guarda una medición recibida del gateway (incluyendo temperatura_corporal y spo2) y la recupera por id', async () => {
    const payload = medicionMock(trabajador.id, dispositivo.id);
    const creada = await medicionRepository.crear(payload);

    expect(creada).toMatchObject({
      id_trabajador: trabajador.id,
      id_dispositivo: dispositivo.id,
      frecuencia_cardiaca: 88,
    });
    expect(Number(creada.temperatura_corporal)).toBeCloseTo(36.6);
    expect(Number(creada.spo2)).toBe(98);

    const recuperada = await medicionRepository.obtenerPorId(creada.id);
    expect(recuperada).toMatchObject({ id: creada.id, id_trabajador: trabajador.id });
  });

  it('guarda una medición sin temperatura_corporal/spo2 (el wearable no siempre los reporta)', async () => {
    const payload = medicionMock(trabajador.id, dispositivo.id, {
      temperaturaCorporal: undefined,
      spo2: undefined,
    });

    const creada = await medicionRepository.crear(payload);
    expect(creada.temperatura_corporal).toBeNull();
    expect(creada.spo2).toBeNull();
  });

  it('lista mediciones de un trabajador filtrando por rango de fechas', async () => {
    await medicionRepository.crear(
      medicionMock(trabajador.id, dispositivo.id, { fechaHora: new Date('2026-01-01T10:00:00Z') }),
    );
    await medicionRepository.crear(
      medicionMock(trabajador.id, dispositivo.id, { fechaHora: new Date('2026-06-01T10:00:00Z') }),
    );

    const enRango = await medicionRepository.listarPorTrabajador(trabajador.id, {
      desde: new Date('2026-05-01T00:00:00Z'),
      hasta: new Date('2026-07-01T00:00:00Z'),
    });

    expect(enRango).toHaveLength(1);
  });

  // El contrato de ingesta del service es el paquete del gateway (validado por
  // el Servicio de Validación de Datos, RF-04/H0008); ver la cobertura completa
  // en tests/services/ y tests/integration/.
  it('vía el service, rechaza un paquete del gateway sin campos obligatorios', async () => {
    await expect(medicionesService.registrarMedicion({ frecuenciaCardiaca: 90 })).rejects.toThrow(
      /Campos obligatorios ausentes/,
    );
  });

  it('vía el service, guarda una medición válida end-to-end', async () => {
    consentimientoCache.limpiar();
    await asignacionDispositivoRepository.crear({
      idTrabajador: trabajador.id,
      idDispositivo: dispositivo.id,
    });
    await registroConsentimientoRepository.crear({
      idTrabajador: trabajador.id,
      estado: true,
      versionPolitica: 'v1.0',
    });

    const paquete = {
      idDispositivo: dispositivo.id,
      timestamp: '2026-07-18T12:00:00.000Z',
      frecuenciaCardiaca: 88,
      nivelActividad: 0.5,
    };
    const guardada = await medicionesService.registrarMedicion(paquete);

    expect(guardada.id).toBeDefined();
    expect(guardada.id_trabajador).toBe(trabajador.id);

    const listado = await medicionesService.listarMedicionesDeTrabajador(trabajador.id);
    expect(listado).toHaveLength(1);
  });
});
