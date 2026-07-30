/**
 * Integración real (no mocks de pg) de los repositorios usados por H0022:
 * operario, dispositivo y las extensiones de asignacionDispositivo.
 */

const { cerrarPool } = require('../helpers/testDb');
const db = require('../../src/config/database');
const operarioRepository = require('../../src/repositories/operario.repository');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const asignacionRepository = require('../../src/repositories/asignacionDispositivo.repository');

// No se usa tests/helpers/testDb.js: trunca las 17 tablas del DER completo,
// pero esta suite sólo depende de las tablas creadas por la migración base
// de H0022 (ver database/migrations/20260718000001_create-base-schema-h0022.js).
const truncarTablasH0022 = () => db.query(
  'TRUNCATE TABLE log_auditoria, asignacion_dispositivo, dispositivo, operario, usuario_rol, usuario, empresa RESTART IDENTITY CASCADE;',
);

const crearEmpresa = async () => {
  const res = await db.query(
    `INSERT INTO empresa (nombre, cuit) VALUES ('Empresa Test', '20111111111') RETURNING *;`,
  );
  return res.rows[0];
};

const crearOperario = async (idEmpresa, { legajo, estado = true } = {}) => {
  const res = await db.query(
    `INSERT INTO operario (id_empresa, legajo, nombre, apellido, estado)
     VALUES ($1, $2, 'Nombre', 'Apellido', $3) RETURNING *;`,
    [idEmpresa, legajo || `EMP-${Math.floor(Math.random() * 100000)}`, estado],
  );
  return res.rows[0];
};

const crearDispositivo = async () => {
  const res = await db.query(
    `INSERT INTO dispositivo (marca, modelo) VALUES ('garmin', 'a') RETURNING *;`,
  );
  return res.rows[0];
};

describe('repositorios de asociación wearable-trabajador', () => {
  let empresa;

  beforeEach(async () => {
    await truncarTablasH0022();
    empresa = await crearEmpresa();
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('operarioRepository.listarActivos sólo devuelve operarios con estado true', async () => {
    await crearOperario(empresa.id, { estado: true });
    await crearOperario(empresa.id, { estado: false });
    await crearOperario(empresa.id, { estado: null });

    const activos = await operarioRepository.listarActivos();
    expect(activos).toHaveLength(1);
  });

  it('dispositivoRepository.listarDisponibles excluye wearables con asignación vigente', async () => {
    const trabajador = await crearOperario(empresa.id);
    const libre = await crearDispositivo();
    const asignado = await crearDispositivo();

    await asignacionRepository.crear({ idTrabajador: trabajador.id, idDispositivo: asignado.id });

    const disponibles = await dispositivoRepository.listarDisponibles();
    expect(disponibles.map((d) => d.id)).toEqual([libre.id]);
  });

  it('dispositivoRepository.listarDisponibles vuelve a incluir un wearable tras finalizar su asociación', async () => {
    const trabajador = await crearOperario(empresa.id);
    const dispositivo = await crearDispositivo();
    const asignacion = await asignacionRepository.crear({
      idTrabajador: trabajador.id,
      idDispositivo: dispositivo.id,
    });

    expect(await dispositivoRepository.listarDisponibles()).toHaveLength(0);

    await asignacionRepository.finalizar(asignacion.id);

    const disponibles = await dispositivoRepository.listarDisponibles();
    expect(disponibles.map((d) => d.id)).toEqual([dispositivo.id]);
  });

  it('asignacionDispositivoRepository.actualizar modifica fecha_hasta y obtenerPorId la refleja', async () => {
    const trabajador = await crearOperario(empresa.id);
    const dispositivo = await crearDispositivo();
    const asignacion = await asignacionRepository.crear({
      idTrabajador: trabajador.id,
      idDispositivo: dispositivo.id,
    });

    const nuevaFechaHasta = '2026-12-31T00:00:00.000Z';
    await asignacionRepository.actualizar(asignacion.id, { fechaHasta: nuevaFechaHasta });

    const actualizada = await asignacionRepository.obtenerPorId(asignacion.id);
    expect(new Date(actualizada.fecha_hasta).toISOString()).toBe(nuevaFechaHasta);
  });

  it('asignacionDispositivoRepository.actualizar sin fechaHasta no borra la fecha_hasta existente', async () => {
    const trabajador = await crearOperario(empresa.id);
    const dispositivo = await crearDispositivo();
    const asignacion = await asignacionRepository.crear({
      idTrabajador: trabajador.id,
      idDispositivo: dispositivo.id,
    });

    const nuevaFechaHasta = '2026-12-31T00:00:00.000Z';
    await asignacionRepository.actualizar(asignacion.id, { fechaHasta: nuevaFechaHasta });
    await asignacionRepository.actualizar(asignacion.id, {});

    const actualizada = await asignacionRepository.obtenerPorId(asignacion.id);
    expect(new Date(actualizada.fecha_hasta).toISOString()).toBe(nuevaFechaHasta);
  });

  it('asignacionDispositivoRepository.finalizar setea fecha_hasta a ahora', async () => {
    const trabajador = await crearOperario(empresa.id);
    const dispositivo = await crearDispositivo();
    const asignacion = await asignacionRepository.crear({
      idTrabajador: trabajador.id,
      idDispositivo: dispositivo.id,
    });

    const finalizada = await asignacionRepository.finalizar(asignacion.id);
    expect(finalizada.fecha_hasta).not.toBeNull();
    expect(new Date(finalizada.fecha_hasta).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
