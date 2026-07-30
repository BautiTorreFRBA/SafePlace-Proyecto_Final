/**
 * Integración de los endpoints de H0007 que usa el hub (autenticados por
 * x-device-api-key, no por sesión de usuario): lookup MAC->id y reporte de
 * estado de conexión.
 */

process.env.GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || 'test-gateway-api-key';

const { cerrarPool } = require('../helpers/testDb');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/database');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const historialEstadoDispositivoRepository = require('../../src/repositories/historialEstadoDispositivo.repository');

const API_KEY = process.env.GATEWAY_API_KEY;
const truncarTablas = () => db.query(
  'TRUNCATE TABLE historial_estado_dispositivo, dispositivo RESTART IDENTITY CASCADE;',
);

describe('endpoints de dispositivos para el hub (H0007)', () => {
  beforeEach(async () => {
    await truncarTablas();
  });

  afterAll(async () => {
    await cerrarPool();
  });

  describe('GET /api/v1/dispositivos/lookup', () => {
    it('rechaza sin x-device-api-key (401)', async () => {
      const res = await request(app).get('/api/v1/dispositivos/lookup?mac=AA:BB:CC:DD:EE:01');
      expect(res.status).toBe(401);
    });

    it('resuelve el id a partir de la MAC (200)', async () => {
      const dispositivo = await dispositivoRepository.crear({
        marca: 'garmin', modelo: 'vivosmart5', direccionMac: 'AA:BB:CC:DD:EE:01',
      });

      const res = await request(app)
        .get('/api/v1/dispositivos/lookup?mac=AA:BB:CC:DD:EE:01')
        .set('x-device-api-key', API_KEY);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(dispositivo.id);
    });

    it('404 si la MAC no está registrada', async () => {
      const res = await request(app)
        .get('/api/v1/dispositivos/lookup?mac=FF:FF:FF:FF:FF:FF')
        .set('x-device-api-key', API_KEY);

      expect(res.status).toBe(404);
      expect(res.body.motivo).toBe('DISPOSITIVO_NO_ENCONTRADO');
    });

    it('400 si falta el parámetro mac', async () => {
      const res = await request(app)
        .get('/api/v1/dispositivos/lookup')
        .set('x-device-api-key', API_KEY);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/dispositivos/:id/estado-conexion', () => {
    it('registra el estado de conexión reportado por el hub (201)', async () => {
      const dispositivo = await dispositivoRepository.crear({ marca: 'garmin', modelo: 'vivosmart5' });

      const res = await request(app)
        .post(`/api/v1/dispositivos/${dispositivo.id}/estado-conexion`)
        .set('x-device-api-key', API_KEY)
        .send({ estado: 'CONECTADO' });

      expect(res.status).toBe(201);

      const ultimo = await historialEstadoDispositivoRepository.obtenerUltimoEstado(dispositivo.id);
      expect(ultimo.estado).toBe('CONECTADO');
    });

    it('400 si el estado no es uno de los valores válidos', async () => {
      const dispositivo = await dispositivoRepository.crear({ marca: 'garmin', modelo: 'vivosmart5' });

      const res = await request(app)
        .post(`/api/v1/dispositivos/${dispositivo.id}/estado-conexion`)
        .set('x-device-api-key', API_KEY)
        .send({ estado: 'ALGO_INVALIDO' });

      expect(res.status).toBe(400);
    });

    it('404 si el dispositivo no existe', async () => {
      const res = await request(app)
        .post('/api/v1/dispositivos/999999/estado-conexion')
        .set('x-device-api-key', API_KEY)
        .send({ estado: 'DESCONECTADO' });

      expect(res.status).toBe(404);
    });
  });
});
