/**
 * Integración real (no mocks de pg) del repositorio de auditoría (H0021):
 * filtrado por usuario, tipo de operación y rango de fechas.
 */

const { cerrarPool } = require('../helpers/testDb');
const db = require('../../src/config/database');
const logAuditoriaRepository = require('../../src/repositories/logAuditoria.repository');

// No se usa tests/helpers/testDb.js: trunca las 17 tablas del DER completo,
// pero esta suite sólo depende de las tablas creadas por la migración base
// de H0022 (log_auditoria, usuario, empresa).
const truncarTablas = () => db.query(
  'TRUNCATE TABLE log_auditoria, usuario, empresa RESTART IDENTITY CASCADE;',
);

const crearEmpresa = async () => {
  const res = await db.query(
    `INSERT INTO empresa (nombre, cuit) VALUES ('Empresa Test', '20111111111') RETURNING *;`,
  );
  return res.rows[0];
};

const crearUsuario = async (idEmpresa, overrides = {}) => {
  const res = await db.query(
    `INSERT INTO usuario (id_empresa, nombre, apellido, email, password_hash, activo)
     VALUES ($1, $2, $3, $4, 'hash', true) RETURNING *;`,
    [
      idEmpresa,
      overrides.nombre || 'Nombre',
      overrides.apellido || 'Apellido',
      overrides.email || `user${Math.floor(Math.random() * 100000)}@test.com`,
    ],
  );
  return res.rows[0];
};

const registrar = (overrides) => logAuditoriaRepository.registrar({
  idUsuario: null,
  tablaAfectada: 'asignacion_dispositivo',
  idRegistro: null,
  operacion: 'CREATE',
  ipOrigen: '127.0.0.1',
  detalle: 'detalle de prueba',
  ...overrides,
});

describe('logAuditoriaRepository', () => {
  let empresa;
  let usuarioA;
  let usuarioB;

  beforeEach(async () => {
    await truncarTablas();
    empresa = await crearEmpresa();
    usuarioA = await crearUsuario(empresa.id, { email: 'a@test.com' });
    usuarioB = await crearUsuario(empresa.id, { email: 'b@test.com' });
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('registrar persiste el registro con fecha/hora, IP y detalle', async () => {
    const registro = await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });

    expect(registro.id_usuario).toBe(usuarioA.id);
    expect(registro.operacion).toBe('CREATE');
    expect(registro.ip_origen).toBe('127.0.0.1');
    expect(registro.fecha_hora).not.toBeNull();
  });

  it('listar sin filtros devuelve todo el historial con datos del usuario, más reciente primero', async () => {
    await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });
    await registrar({ idUsuario: usuarioB.id, operacion: 'UPDATE' });

    const registros = await logAuditoriaRepository.listar();

    expect(registros).toHaveLength(2);
    expect(registros[0].operacion).toBe('UPDATE');
    expect(registros[0].usuario_email).toBe('b@test.com');
    expect(registros[1].usuario_email).toBe('a@test.com');
  });

  it('listar filtra por usuario', async () => {
    await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });
    await registrar({ idUsuario: usuarioB.id, operacion: 'CREATE' });

    const registros = await logAuditoriaRepository.listar({ idUsuario: usuarioA.id });

    expect(registros).toHaveLength(1);
    expect(registros[0].id_usuario).toBe(usuarioA.id);
  });

  it('listar filtra por tipo de operación', async () => {
    await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });
    await registrar({ idUsuario: usuarioA.id, operacion: 'FINALIZAR' });

    const registros = await logAuditoriaRepository.listar({ operacion: 'FINALIZAR' });

    expect(registros).toHaveLength(1);
    expect(registros[0].operacion).toBe('FINALIZAR');
  });

  it('listar filtra por rango de fechas', async () => {
    const viejo = await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });
    await db.query('UPDATE log_auditoria SET fecha_hora = $1 WHERE id = $2;', ['2020-01-01T00:00:00Z', viejo.id]);
    await registrar({ idUsuario: usuarioA.id, operacion: 'UPDATE' });

    const registros = await logAuditoriaRepository.listar({ fechaDesde: new Date('2025-01-01T00:00:00Z') });

    expect(registros).toHaveLength(1);
    expect(registros[0].operacion).toBe('UPDATE');
  });

  it('listar admite id_usuario nulo (operaciones sin actor humano, ej. gateway)', async () => {
    await registrar({ idUsuario: null, operacion: 'DESCARTE_VALIDACION' });

    const registros = await logAuditoriaRepository.listar();

    expect(registros).toHaveLength(1);
    expect(registros[0].id_usuario).toBeNull();
    expect(registros[0].usuario_email).toBeNull();
  });

  it('contar respeta los mismos filtros que listar (para paginación)', async () => {
    await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });
    await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });
    await registrar({ idUsuario: usuarioB.id, operacion: 'CREATE' });

    const total = await logAuditoriaRepository.contar({ idUsuario: usuarioA.id });

    expect(total).toBe(2);
  });

  it('listar respeta limit y offset', async () => {
    await registrar({ idUsuario: usuarioA.id, operacion: 'CREATE' });
    await registrar({ idUsuario: usuarioA.id, operacion: 'UPDATE' });
    await registrar({ idUsuario: usuarioA.id, operacion: 'FINALIZAR' });

    const pagina = await logAuditoriaRepository.listar({ limit: 1, offset: 1 });

    expect(pagina).toHaveLength(1);
    expect(pagina[0].operacion).toBe('UPDATE');
  });
});
