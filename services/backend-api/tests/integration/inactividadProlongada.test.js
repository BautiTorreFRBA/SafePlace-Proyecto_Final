/**
 * Integración end-to-end de CP-E2E-04 (H0012 reencuadrada): el wearable de
 * un operario estuvo DESCONECTADO más que la tolerancia configurada mientras
 * el operario estaba en horario laboral -> se genera la alerta
 * INACTIVIDAD_PROLONGADA + notificación, visible en la bandeja de activas y
 * en el histórico, y se cierra al reconectar.
 *
 * Paquetes reales contra la base de test; el chequeo periódico se invoca
 * directamente (en producción lo dispara el setInterval de server.js).
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
const umbralRiesgoRepository = require('../../src/repositories/umbralRiesgo.repository');
const historialEstadoDispositivoRepository = require('../../src/repositories/historialEstadoDispositivo.repository');
const inactividadProlongadaService = require('../../src/services/inactividadProlongada.service');

const UMBRAL = {
  fcFatiga: 140,
  minutosFatiga: 10,
  fcSobreesfuerzo: 170,
  actividadSobreesfuerzo: 0.8,
  minutosInactividad: 15,
  minutosDesconexionTolerada: 10,
};

const contarFilas = async (tabla) => {
  const res = await getPool().query(`SELECT COUNT(*)::int AS n FROM ${tabla};`);
  return res.rows[0].n;
};

// Cubre las 24hs de los 7 días -> "ahora" siempre cae dentro (evita
// dependencias de zona horaria en el test).
const sembrarHorarioCompleto = async (idOperario) => {
  for (let dia = 1; dia <= 7; dia += 1) {
    await getPool().query(
      `INSERT INTO horario_operario (id_operario, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, '00:00', '23:59');`,
      [idOperario, dia],
    );
  }
};

describe('CP-E2E-04 — inactividad prolongada (wearable desconectado en horario laboral)', () => {
  let empresa;
  let operario;
  let dispositivo;
  let usuarioId;

  const tokenPara = (role) => jwt.sign({ sub: usuarioId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  beforeEach(async () => {
    await truncarTodo();

    empresa = await empresaRepository.crear(empresaMock());
    operario = await operarioRepository.crear(trabajadorMock(empresa.id));
    dispositivo = await dispositivoRepository.crear(dispositivoMock({ direccionMac: 'AA:BB:CC:DD:EE:04' }));
    await asignacionDispositivoRepository.crear({ idTrabajador: operario.id, idDispositivo: dispositivo.id });
    await umbralRiesgoRepository.crear(UMBRAL);

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

  it('genera alerta + notificación cuando la desconexión supera la tolerancia en horario laboral', async () => {
    await sembrarHorarioCompleto(operario.id);
    // Desconectado desde hace 15 min (> 10 de tolerancia).
    await historialEstadoDispositivoRepository.registrarEstado(
      dispositivo.id, 'DESCONECTADO', new Date(Date.now() - 15 * 60 * 1000),
    );

    const generadas = await inactividadProlongadaService.chequear();
    expect(generadas).toBe(1);

    expect(await contarFilas('alerta')).toBe(1);
    expect(await contarFilas('notificacion')).toBe(1);

    const { rows } = await getPool().query(
      `SELECT a.estado, a.id_medicion, a.id_seudonimo, ta.nombre
       FROM alerta a JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta;`,
    );
    expect(rows[0]).toMatchObject({ nombre: 'INACTIVIDAD_PROLONGADA', estado: 'Activa', id_medicion: null });
    expect(rows[0].id_seudonimo).not.toBeNull();

    const token = tokenPara('supervisor');
    const activas = await request(app).get('/api/v1/alertas/activas').set('Authorization', `Bearer ${token}`);
    expect(activas.status).toBe(200);
    expect(activas.body.data).toHaveLength(1);
    expect(activas.body.data[0]).toMatchObject({
      tipo_alerta: 'INACTIVIDAD_PROLONGADA',
      operario_nombre: operario.nombre,
      operario_apellido: operario.apellido,
    });

    const historico = await request(app)
      .get('/api/v1/alertas/historico?desde=2020-01-01')
      .set('Authorization', `Bearer ${token}`);
    expect(historico.body.data.map((a) => a.tipo_alerta)).toContain('INACTIVIDAD_PROLONGADA');

    const notifs = await request(app).get('/api/v1/notificaciones').set('Authorization', `Bearer ${token}`);
    expect(notifs.body.data).toHaveLength(1);
    expect(notifs.body.data[0].tipo_alerta).toBe('INACTIVIDAD_PROLONGADA');
    expect(notifs.body.data[0].operario_nombre).toBe(operario.nombre);
  });

  it('NO genera alerta si la desconexión ocurre fuera del horario laboral', async () => {
    // Sin filas en horario_operario -> nunca "en horario".
    await historialEstadoDispositivoRepository.registrarEstado(
      dispositivo.id, 'DESCONECTADO', new Date(Date.now() - 30 * 60 * 1000),
    );

    const generadas = await inactividadProlongadaService.chequear();
    expect(generadas).toBe(0);
    expect(await contarFilas('alerta')).toBe(0);
  });

  it('NO genera alerta si la desconexión todavía no supera la tolerancia', async () => {
    await sembrarHorarioCompleto(operario.id);
    await historialEstadoDispositivoRepository.registrarEstado(
      dispositivo.id, 'DESCONECTADO', new Date(Date.now() - 5 * 60 * 1000),
    );

    expect(await inactividadProlongadaService.chequear()).toBe(0);
    expect(await contarFilas('alerta')).toBe(0);
  });

  it('antiduplicado: dos corridas seguidas no generan una segunda alerta', async () => {
    await sembrarHorarioCompleto(operario.id);
    await historialEstadoDispositivoRepository.registrarEstado(
      dispositivo.id, 'DESCONECTADO', new Date(Date.now() - 20 * 60 * 1000),
    );

    expect(await inactividadProlongadaService.chequear()).toBe(1);
    expect(await inactividadProlongadaService.chequear()).toBe(0);
    expect(await contarFilas('alerta')).toBe(1);
  });

  it('la alerta se cierra cuando el wearable reporta CONECTADO', async () => {
    await sembrarHorarioCompleto(operario.id);
    await historialEstadoDispositivoRepository.registrarEstado(
      dispositivo.id, 'DESCONECTADO', new Date(Date.now() - 20 * 60 * 1000),
    );
    await inactividadProlongadaService.chequear();

    const res = await request(app)
      .post(`/api/v1/dispositivos/${dispositivo.id}/estado-conexion`)
      .set('x-device-api-key', process.env.GATEWAY_API_KEY)
      .send({ estado: 'CONECTADO' });
    expect(res.status).toBe(201);

    const { rows } = await getPool().query("SELECT estado FROM alerta;");
    expect(rows[0].estado).toBe('Cerrada');
  });
});
