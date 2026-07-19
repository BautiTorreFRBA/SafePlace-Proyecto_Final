/**
 * Tests de integración de la ingesta de mediciones (CP-VAL-001):
 * paquete real vía POST /api/v1/mediciones (gateway simulado con supertest,
 * autenticado por x-device-api-key) contra la base PostgreSQL de test,
 * verificando que el flujo hacia almacenamiento (tabla medicion) y hacia
 * auditoría (tabla log_auditoria) se dispara correctamente.
 *
 * Demuestra el flujo end-to-end en entorno controlado que exige el
 * Definition of Done del Release 2.
 */

process.env.GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || 'test-gateway-api-key';

const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const request = require('supertest');
const app = require('../../src/app');
const { getPool } = require('../../src/config/database');
const { empresaMock, trabajadorMock, dispositivoMock } = require('../fixtures/mockEntities');
const empresaRepository = require('../../src/repositories/empresa.repository');
const trabajadorRepository = require('../../src/repositories/trabajador.repository');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const asignacionDispositivoRepository = require('../../src/repositories/asignacionDispositivo.repository');
const registroConsentimientoRepository = require('../../src/repositories/registroConsentimiento.repository');
const consentimientoCache = require('../../src/services/validacion/consentimiento.cache');

const API_KEY = process.env.GATEWAY_API_KEY;

const postMedicion = (body) =>
  request(app).post('/api/v1/mediciones').set('x-device-api-key', API_KEY).send(body);

const contarFilas = async (tabla, where = '', params = []) => {
  const res = await getPool().query(`SELECT COUNT(*)::int AS n FROM ${tabla} ${where};`, params);
  return res.rows[0].n;
};

const contarDescartesAuditados = () =>
  contarFilas('log_auditoria', "WHERE operacion = 'DESCARTE_VALIDACION'");

// Espera a que la auditoría best-effort (fire-and-forget del JSON corrupto)
// termine de escribir, sin acoplar el test a tiempos fijos largos.
const esperarAuditorias = async (cantidad, intentos = 40) => {
  for (let i = 0; i < intentos; i += 1) {
    if ((await contarDescartesAuditados()) >= cantidad) return;
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('POST /api/v1/mediciones — ingesta con Servicio de Validación de Datos', () => {
  let trabajador;
  let dispositivo;

  const paqueteValido = (overrides = {}) => ({
    idDispositivo: dispositivo.id,
    timestamp: '2026-07-18T12:00:00.000Z',
    frecuenciaCardiaca: 88,
    nivelActividad: 0.5,
    nivelInactividad: 0,
    ...overrides,
  });

  beforeEach(async () => {
    await truncarTodo();
    consentimientoCache.limpiar();

    const empresa = await empresaRepository.crear(empresaMock());
    trabajador = await trabajadorRepository.crear(trabajadorMock(empresa.id));
    dispositivo = await dispositivoRepository.crear(dispositivoMock());
    await asignacionDispositivoRepository.crear({
      idTrabajador: trabajador.id,
      idDispositivo: dispositivo.id,
    });
    await registroConsentimientoRepository.crear({
      idTrabajador: trabajador.id,
      estado: true,
      versionPolitica: 'v1.0',
    });
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('rechaza al gateway sin token de dispositivo (401)', async () => {
    const res = await request(app).post('/api/v1/mediciones').send({});
    expect(res.status).toBe(401);
  });

  it('paquete válido: 201, persiste con el timestamp del paquete y trabajador resuelto', async () => {
    const res = await postMedicion(paqueteValido());
    expect(res.status).toBe(201);

    const medicion = res.body.data;
    expect(medicion.id_trabajador).toBe(trabajador.id);
    expect(medicion.id_dispositivo).toBe(dispositivo.id);
    expect(medicion.frecuencia_cardiaca).toBe(88);
    // fecha_hora = timestamp declarado por el paquete (única marca de tiempo del DER)
    expect(new Date(medicion.fecha_hora).toISOString()).toBe('2026-07-18T12:00:00.000Z');

    expect(await contarFilas('medicion')).toBe(1);
    expect(await contarDescartesAuditados()).toBe(0);
  });

  it('campos incompletos: 400, no persiste y queda auditado', async () => {
    const { timestamp, ...sinTimestamp } = paqueteValido();
    const res = await postMedicion(sinTimestamp);

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('CAMPOS_INCOMPLETOS');
    expect(await contarFilas('medicion')).toBe(0);
    expect(await contarDescartesAuditados()).toBe(1);
  });

  it('BPM fuera de rango biológico: 400, no persiste y queda auditado', async () => {
    const res = await postMedicion(paqueteValido({ frecuenciaCardiaca: 250 }));

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('FUERA_DE_RANGO');
    expect(await contarFilas('medicion')).toBe(0);
    expect(await contarDescartesAuditados()).toBe(1);

    const audit = await getPool().query(
      "SELECT detalle FROM log_auditoria WHERE operacion = 'DESCARTE_VALIDACION';",
    );
    const detalle = JSON.parse(audit.rows[0].detalle);
    expect(detalle.motivo).toBe('FUERA_DE_RANGO');
    expect(detalle.idDispositivo).toBe(dispositivo.id);
    expect(detalle.hashPaquete).toMatch(/^[a-f0-9]{64}$/);
  });

  it('estructura corrupta (JSON inválido): 400 y queda auditado', async () => {
    const res = await request(app)
      .post('/api/v1/mediciones')
      .set('x-device-api-key', API_KEY)
      .set('content-type', 'application/json')
      .send('{"idDispositivo": 1, "frecuenciaCardiaca": '); // JSON truncado

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('ESTRUCTURA_INVALIDA');
    expect(await contarFilas('medicion')).toBe(0);

    await esperarAuditorias(1);
    expect(await contarDescartesAuditados()).toBe(1);
  });

  it('estructura con tipos incorrectos: 400 y queda auditado', async () => {
    const res = await postMedicion(paqueteValido({ frecuenciaCardiaca: 'ochenta' }));

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('ESTRUCTURA_INVALIDA');
    expect(await contarFilas('medicion')).toBe(0);
    expect(await contarDescartesAuditados()).toBe(1);
  });

  it('registro duplicado: el reenvío del mismo paquete responde 409, no duplica fila y queda auditado', async () => {
    const paquete = paqueteValido();

    const primera = await postMedicion(paquete);
    expect(primera.status).toBe(201);

    const reenvio = await postMedicion(paquete);
    expect(reenvio.status).toBe(409);
    expect(reenvio.body.motivo).toBe('DUPLICADO');

    expect(await contarFilas('medicion')).toBe(1);
    expect(await contarDescartesAuditados()).toBe(1);
  });

  it('wearable sin trabajador asignado: 400, no persiste y queda auditado', async () => {
    const otroDispositivo = await dispositivoRepository.crear(dispositivoMock());
    const res = await postMedicion(paqueteValido({ idDispositivo: otroDispositivo.id }));

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('DISPOSITIVO_INVALIDO');
    expect(await contarFilas('medicion')).toBe(0);
    expect(await contarDescartesAuditados()).toBe(1);
  });

  it('consentimiento revocado: 403, el biodato no se persiste ni se audita (descarte en memoria)', async () => {
    await registroConsentimientoRepository.crear({
      idTrabajador: trabajador.id,
      estado: false, // revocación posterior al otorgamiento del beforeEach
      versionPolitica: 'v1.0',
    });
    consentimientoCache.limpiar();

    const res = await postMedicion(paqueteValido());

    expect(res.status).toBe(403);
    expect(await contarFilas('medicion')).toBe(0);
    expect(await contarDescartesAuditados()).toBe(0);
  });

  it('consentimiento inexistente: mismo tratamiento que revocado', async () => {
    // trabajador nuevo sin ningún registro de consentimiento
    const empresa2 = await empresaRepository.crear(empresaMock({ cuit: '30712345699' }));
    const trabajador2 = await trabajadorRepository.crear(trabajadorMock(empresa2.id));
    const dispositivo2 = await dispositivoRepository.crear(dispositivoMock());
    await asignacionDispositivoRepository.crear({
      idTrabajador: trabajador2.id,
      idDispositivo: dispositivo2.id,
    });

    const res = await postMedicion(paqueteValido({ idDispositivo: dispositivo2.id }));

    expect(res.status).toBe(403);
    expect(await contarFilas('medicion')).toBe(0);
    expect(await contarDescartesAuditados()).toBe(0);
  });
});
