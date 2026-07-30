/**
 * Integración real (no mocks de pg) de dispositivo.repository: alta y
 * dirección MAC (H0007).
 */

const { cerrarPool } = require('../helpers/testDb');
const db = require('../../src/config/database');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');

const truncarTablas = () => db.query('TRUNCATE TABLE dispositivo RESTART IDENTITY CASCADE;');

describe('dispositivo.repository', () => {
  beforeEach(async () => {
    await truncarTablas();
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('crear inserta un dispositivo, con o sin MAC', async () => {
    const sinMac = await dispositivoRepository.crear({ marca: 'garmin', modelo: 'vivosmart5' });
    expect(sinMac.direccion_mac).toBeNull();

    const conMac = await dispositivoRepository.crear({
      marca: 'garmin', modelo: 'vivosmart5', direccionMac: 'AA:BB:CC:DD:EE:01',
    });
    expect(conMac.direccion_mac).toBe('AA:BB:CC:DD:EE:01');
  });

  it('obtenerPorMac encuentra el dispositivo por su dirección MAC', async () => {
    const creado = await dispositivoRepository.crear({
      marca: 'garmin', modelo: 'vivosmart5', direccionMac: 'AA:BB:CC:DD:EE:02',
    });

    const encontrado = await dispositivoRepository.obtenerPorMac('AA:BB:CC:DD:EE:02');
    expect(encontrado.id).toBe(creado.id);
  });

  it('obtenerPorMac devuelve null si ninguna MAC coincide', async () => {
    const encontrado = await dispositivoRepository.obtenerPorMac('FF:FF:FF:FF:FF:FF');
    expect(encontrado).toBeNull();
  });

  it('actualizarMac setea la MAC de un dispositivo existente', async () => {
    const creado = await dispositivoRepository.crear({ marca: 'garmin', modelo: 'vivosmart5' });

    const actualizado = await dispositivoRepository.actualizarMac(creado.id, 'AA:BB:CC:DD:EE:03');
    expect(actualizado.direccion_mac).toBe('AA:BB:CC:DD:EE:03');
  });

  it('la dirección MAC es única entre dispositivos', async () => {
    await dispositivoRepository.crear({
      marca: 'garmin', modelo: 'vivosmart5', direccionMac: 'AA:BB:CC:DD:EE:04',
    });
    const otro = await dispositivoRepository.crear({ marca: 'garmin', modelo: 'vivosmart5' });

    await expect(
      dispositivoRepository.actualizarMac(otro.id, 'AA:BB:CC:DD:EE:04'),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
