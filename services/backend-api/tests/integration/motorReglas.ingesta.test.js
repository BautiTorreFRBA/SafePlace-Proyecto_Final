/**
 * Tests de integración del Motor de Reglas end-to-end (H0010 fatiga, H0011
 * sobreesfuerzo, H0012 inactividad prolongada, H0013 centralización de
 * alertas, H0023 configuración de umbrales, H0015 notificaciones): paquetes
 * reales vía POST /api/v1/mediciones contra la base de test, más los
 * endpoints HTTP nuevos (PUT /umbrales, GET/PATCH /alertas, GET/PATCH
 * /notificaciones) con JWT reales.
 */

process.env.GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || 'test-gateway-api-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const app = require('../../src/app');
const { getPool } = require('../../src/config/database');
const { empresaMock, trabajadorMock, dispositivoMock } = require('../fixtures/mockEntities');
const empresaRepository = require('../../src/repositories/empresa.repository');
const operarioRepository = require('../../src/repositories/operario.repository');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const asignacionDispositivoRepository = require('../../src/repositories/asignacionDispositivo.repository');
const registroConsentimientoRepository = require('../../src/repositories/registroConsentimiento.repository');
const operarioSeudonimoRepository = require('../../src/repositories/operarioSeudonimo.repository');
const medicionRepository = require('../../src/repositories/medicion.repository');
const umbralRiesgoRepository = require('../../src/repositories/umbralRiesgo.repository');
const consentimientoCache = require('../../src/services/validacion/consentimiento.cache');

const API_KEY = process.env.GATEWAY_API_KEY;

const UMBRAL = {
  fcFatiga: 140,
  minutosFatiga: 10,
  fcSobreesfuerzo: 170,
  actividadSobreesfuerzo: 0.8,
  minutosInactividad: 15,
  minutosDesconexionTolerada: 10,
};

const postMedicion = (body) =>
  request(app).post('/api/v1/mediciones').set('x-device-api-key', API_KEY).send(body);

const contarFilas = async (tabla) => {
  const res = await getPool().query(`SELECT COUNT(*)::int AS n FROM ${tabla};`);
  return res.rows[0].n;
};

describe('Motor de Reglas end-to-end', () => {
  let trabajador;
  let dispositivo;
  let usuarioId;

  const tokenPara = (role) => jwt.sign({ sub: usuarioId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  beforeEach(async () => {
    await truncarTodo();
    consentimientoCache.limpiar();

    const empresa = await empresaRepository.crear(empresaMock());
    trabajador = await operarioRepository.crear(trabajadorMock(empresa.id));
    dispositivo = await dispositivoRepository.crear(dispositivoMock());
    await asignacionDispositivoRepository.crear({ idTrabajador: trabajador.id, idDispositivo: dispositivo.id });
    await registroConsentimientoRepository.crear({ idOperario: trabajador.id, estado: true, versionPolitica: 'v1.0' });
    await umbralRiesgoRepository.crear(UMBRAL);

    // Usuario real (no sólo un id inventado en el JWT): id_usuario de
    // umbral_riesgo/log_auditoria es una FK de verdad hacia `usuario`.
    const usuario = await getPool().query(
      `INSERT INTO usuario (id_empresa, nombre, apellido, email, password_hash, activo)
       VALUES ($1, 'Test', 'User', $2, 'hash', true) RETURNING id;`,
      [empresa.id, `test-${empresa.id}@safeplace.test`],
    );
    usuarioId = usuario.rows[0].id;
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('sin umbrales configurados (H0023 nunca corrido): ninguna medición genera alerta', async () => {
    await getPool().query('TRUNCATE TABLE umbral_riesgo RESTART IDENTITY CASCADE;');

    const res = await postMedicion({
      idDispositivo: dispositivo.id,
      timestamp: new Date().toISOString(),
      frecuenciaCardiaca: 200,
      nivelActividad: 1,
    });

    expect(res.status).toBe(201);
    expect(await contarFilas('alerta')).toBe(0);
  });

  it('H0011 sobreesfuerzo: FC alta + actividad alta genera una alerta y su notificación', async () => {
    const res = await postMedicion({
      idDispositivo: dispositivo.id,
      timestamp: new Date().toISOString(),
      frecuenciaCardiaca: 180,
      nivelActividad: 0.9,
    });
    expect(res.status).toBe(201);

    expect(await contarFilas('alerta')).toBe(1);
    expect(await contarFilas('notificacion')).toBe(1);

    const { rows } = await getPool().query(
      'SELECT a.estado, ta.nombre, ta.prioridad FROM alerta a JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta;',
    );
    expect(rows[0]).toMatchObject({ nombre: 'SOBREESFUERZO', prioridad: 'Crítica', estado: 'Activa' });
  });

  it('H0013 antiduplicado: mientras la alerta siga Activa, no se genera una segunda por la misma condición', async () => {
    // Timestamps fijos lejos de "ahora" a propósito: esta prueba es sólo de
    // sobreesfuerzo (puntual) y no debe interactuar con la ventana temporal
    // de fatiga (basada en now() real).
    await postMedicion({
      idDispositivo: dispositivo.id,
      timestamp: '2020-01-01T10:00:00.000Z',
      frecuenciaCardiaca: 180,
      nivelActividad: 0.9,
    });
    await postMedicion({
      idDispositivo: dispositivo.id,
      timestamp: '2020-01-01T10:05:00.000Z',
      frecuenciaCardiaca: 185,
      nivelActividad: 0.95,
    });

    expect(await contarFilas('alerta')).toBe(1);
  });

  it('H0010 fatiga: FC sostenida por encima del umbral durante el tiempo configurado genera alerta', async () => {
    const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);

    // Historial real: FC alta constante desde hace ~10:45 (más que los 10
    // min configurados) hasta ahora.
    await medicionRepository.crear({
      idSeudonimo: seudonimo.id,
      idDispositivo: dispositivo.id,
      fechaHora: new Date(Date.now() - 10.75 * 60 * 1000),
      frecuenciaCardiaca: 150,
    });
    await medicionRepository.crear({
      idSeudonimo: seudonimo.id,
      idDispositivo: dispositivo.id,
      fechaHora: new Date(Date.now() - 5 * 60 * 1000),
      frecuenciaCardiaca: 150,
    });

    const res = await postMedicion({
      idDispositivo: dispositivo.id,
      timestamp: new Date().toISOString(),
      frecuenciaCardiaca: 150,
      nivelActividad: 0.2,
    });
    expect(res.status).toBe(201);

    const { rows } = await getPool().query(
      'SELECT ta.nombre FROM alerta a JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta;',
    );
    expect(rows.map((r) => r.nombre)).toContain('FATIGA');
  });

  it('H0010 fatiga: NO se dispara si la FC alta es un pico reciente, sin sostenerse en el tiempo', async () => {
    const res = await postMedicion({
      idDispositivo: dispositivo.id,
      timestamp: new Date().toISOString(),
      frecuenciaCardiaca: 150, // supera fc_fatiga, pero es la única lectura
      nivelActividad: 0.2,
    });
    expect(res.status).toBe(201);

    const { rows } = await getPool().query(
      'SELECT ta.nombre FROM alerta a JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta;',
    );
    expect(rows.map((r) => r.nombre)).not.toContain('FATIGA');
  });

  describe('endpoints protegidos', () => {
    it('bandeja de activas, PATCH de estado (H0013) y ciclo de notificaciones (H0015), autorizado', async () => {
      await postMedicion({
        idDispositivo: dispositivo.id,
        timestamp: new Date().toISOString(),
        frecuenciaCardiaca: 180,
        nivelActividad: 0.9,
      });

      const token = tokenPara('seguridad');

      const activas = await request(app).get('/api/v1/alertas/activas').set('Authorization', `Bearer ${token}`);
      expect(activas.status).toBe(200);
      expect(activas.body.data).toHaveLength(1);
      expect(activas.body.data[0].operario_nombre).toBe(trabajador.nombre);
      const idAlerta = activas.body.data[0].id;

      const patch = await request(app)
        .patch(`/api/v1/alertas/${idAlerta}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'Atendida' });
      expect(patch.status).toBe(200);
      expect(patch.body.data.estado).toBe('Atendida');

      const activasLuego = await request(app).get('/api/v1/alertas/activas').set('Authorization', `Bearer ${token}`);
      expect(activasLuego.body.data).toHaveLength(0);

      const notifs = await request(app).get('/api/v1/notificaciones').set('Authorization', `Bearer ${token}`);
      expect(notifs.status).toBe(200);
      expect(notifs.body.data).toHaveLength(1);
      expect(notifs.body.data[0].leida).toBe(false);
      const idNotif = notifs.body.data[0].id;

      const marcada = await request(app)
        .patch(`/api/v1/notificaciones/${idNotif}/leida`)
        .set('Authorization', `Bearer ${token}`);
      expect(marcada.status).toBe(200);
      expect(marcada.body.data.leida).toBe(true);

      const soloNoLeidas = await request(app)
        .get('/api/v1/notificaciones?leida=false')
        .set('Authorization', `Bearer ${token}`);
      expect(soloNoLeidas.body.data).toHaveLength(0);
    });

    it('PATCH /alertas/:id: rechaza sin token (401) y con estado inválido (400)', async () => {
      const sinToken = await request(app).patch('/api/v1/alertas/1').send({ estado: 'Atendida' });
      expect(sinToken.status).toBe(401);

      const token = tokenPara('seguridad');
      const estadoInvalido = await request(app)
        .patch('/api/v1/alertas/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'Activa' }); // sólo Atendida/Cerrada son válidos por PATCH
      expect(estadoInvalido.status).toBe(400);
    });

    it('PUT /api/v1/umbrales (H0023): configura una versión nueva, la deja auditada y consultable', async () => {
      const token = tokenPara('seguridad');

      const res = await request(app)
        .put('/api/v1/umbrales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fcFatiga: 145, minutosFatiga: 8, fcSobreesfuerzo: 175, actividadSobreesfuerzo: 0.85, minutosInactividad: 20, minutosDesconexionTolerada: 12,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.fc_fatiga).toBe(145);
      expect(res.body.data.minutos_desconexion_tolerada).toBe(12);

      const vigente = await request(app).get('/api/v1/umbrales').set('Authorization', `Bearer ${token}`);
      expect(vigente.body.data.fc_fatiga).toBe(145);

      const historial = await request(app).get('/api/v1/umbrales/historial').set('Authorization', `Bearer ${token}`);
      expect(historial.body.data).toHaveLength(2); // el del beforeEach + este

      const auditoria = await getPool().query("SELECT * FROM log_auditoria WHERE tabla_afectada = 'umbral_riesgo';");
      expect(auditoria.rowCount).toBe(1);
    });

    it('PUT /api/v1/umbrales: rechaza valores no positivos (400) y rechaza el rol supervisor (403)', async () => {
      const token = tokenPara('seguridad');
      const invalido = await request(app)
        .put('/api/v1/umbrales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fcFatiga: -5, minutosFatiga: 8, fcSobreesfuerzo: 175, actividadSobreesfuerzo: 0.85, minutosInactividad: 20, minutosDesconexionTolerada: 12,
        });
      expect(invalido.status).toBe(400);

      const tokenSupervisor = tokenPara('supervisor');
      const noAutorizado = await request(app)
        .put('/api/v1/umbrales')
        .set('Authorization', `Bearer ${tokenSupervisor}`)
        .send({
          fcFatiga: 145, minutosFatiga: 8, fcSobreesfuerzo: 175, actividadSobreesfuerzo: 0.85, minutosInactividad: 20, minutosDesconexionTolerada: 12,
        });
      expect(noAutorizado.status).toBe(403);
    });
  });
});
