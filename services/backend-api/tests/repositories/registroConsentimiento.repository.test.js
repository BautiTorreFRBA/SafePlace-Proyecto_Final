/**
 * Integración real (no mocks de pg) del repositorio de registro de
 * consentimiento (H0019).
 */

const { cerrarPool } = require('../helpers/testDb');
const db = require('../../src/config/database');
const registroConsentimientoRepository = require('../../src/repositories/registroConsentimiento.repository');

// No se usa tests/helpers/testDb.js: trunca las 17 tablas del DER completo,
// pero esta suite sólo depende de las tablas creadas por la migración base
// de H0022 más registro_consentimiento (H0019).
const truncarTablasH0019 = () => db.query(
  'TRUNCATE TABLE registro_consentimiento, operario, empresa RESTART IDENTITY CASCADE;',
);

const crearEmpresa = async () => {
  const res = await db.query(
    `INSERT INTO empresa (nombre, cuit) VALUES ('Empresa Test', '20111111111') RETURNING *;`,
  );
  return res.rows[0];
};

const crearOperario = async (idEmpresa) => {
  const res = await db.query(
    `INSERT INTO operario (id_empresa, legajo, nombre, apellido, estado)
     VALUES ($1, $2, 'Nombre', 'Apellido', true) RETURNING *;`,
    [idEmpresa, `EMP-${Math.floor(Math.random() * 100000)}`],
  );
  return res.rows[0];
};

describe('registroConsentimientoRepository', () => {
  let empresa;
  let operario;

  beforeEach(async () => {
    await truncarTablasH0019();
    empresa = await crearEmpresa();
    operario = await crearOperario(empresa.id);
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('crear inserta un registro de otorgamiento con timestamp y versión de política', async () => {
    const registro = await registroConsentimientoRepository.crear({
      idOperario: operario.id,
      estado: true,
      versionPolitica: 'v1',
    });

    expect(registro.id_operario).toBe(operario.id);
    expect(registro.estado).toBe(true);
    expect(registro.version_politica).toBe('v1');
    expect(registro.fecha_hora).not.toBeNull();
  });

  it('obtenerVigente devuelve el registro más reciente del trabajador', async () => {
    await registroConsentimientoRepository.crear({
      idOperario: operario.id,
      estado: true,
      versionPolitica: 'v1',
    });
    const revocacion = await registroConsentimientoRepository.crear({
      idOperario: operario.id,
      estado: false,
      versionPolitica: 'v1',
    });

    const vigente = await registroConsentimientoRepository.obtenerVigente(operario.id);
    expect(vigente.id).toBe(revocacion.id);
    expect(vigente.estado).toBe(false);
  });

  it('obtenerVigente devuelve undefined si el trabajador nunca registró consentimiento', async () => {
    const vigente = await registroConsentimientoRepository.obtenerVigente(operario.id);
    expect(vigente).toBeUndefined();
  });

  it('listarPorTrabajador devuelve el historial completo, más reciente primero', async () => {
    await registroConsentimientoRepository.crear({
      idOperario: operario.id,
      estado: true,
      versionPolitica: 'v1',
    });
    await registroConsentimientoRepository.crear({
      idOperario: operario.id,
      estado: false,
      versionPolitica: 'v1',
    });

    const historial = await registroConsentimientoRepository.listarPorTrabajador(operario.id);
    expect(historial).toHaveLength(2);
    expect(historial[0].estado).toBe(false);
    expect(historial[1].estado).toBe(true);
  });
});
