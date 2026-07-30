/**
 * Integración real (no mocks de pg) del repositorio de estado de conexión
 * de dispositivos (H0006/H0007).
 */

const { cerrarPool } = require('../helpers/testDb');
const db = require('../../src/config/database');
const historialEstadoDispositivoRepository = require('../../src/repositories/historialEstadoDispositivo.repository');

const truncarTablas = () => db.query(
  'TRUNCATE TABLE historial_estado_dispositivo, medicion, operario_seudonimo, asignacion_dispositivo, dispositivo, operario, empresa RESTART IDENTITY CASCADE;',
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

const crearDispositivo = async () => {
  const res = await db.query(
    `INSERT INTO dispositivo (marca, modelo) VALUES ('garmin', 'a') RETURNING *;`,
  );
  return res.rows[0];
};

const asignar = (idOperario, idDispositivo, fechaDesde) => db.query(
  `INSERT INTO asignacion_dispositivo (id_trabajador, id_dispositivo, fecha_desde)
   VALUES ($1, $2, $3);`,
  [idOperario, idDispositivo, fechaDesde],
);

// H0020: medicion ya no referencia al operario directamente, sino a su
// seudónimo (creado acá mismo, como hace el flujo real de ingesta).
const crearMedicion = async (idOperario, idDispositivo, fechaHora) => {
  const seudonimo = await db.query(
    `INSERT INTO operario_seudonimo (id_operario, identificador_seudonimo)
     VALUES ($1, $2)
     ON CONFLICT (id_operario) DO UPDATE SET id_operario = EXCLUDED.id_operario
     RETURNING *;`,
    [idOperario, `seudonimo-test-${idOperario}`],
  );
  return db.query(
    `INSERT INTO medicion (id_seudonimo, id_dispositivo, fecha_hora, frecuencia_cardiaca)
     VALUES ($1, $2, $3, 80);`,
    [seudonimo.rows[0].id, idDispositivo, fechaHora],
  );
};

describe('historialEstadoDispositivoRepository', () => {
  let operario;

  beforeEach(async () => {
    await truncarTablas();
    const empresa = await crearEmpresa();
    operario = await crearOperario(empresa.id);
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('registrarEstado inserta y obtenerUltimoEstado devuelve el más reciente', async () => {
    const dispositivo = await crearDispositivo();
    await historialEstadoDispositivoRepository.registrarEstado(dispositivo.id, 'CONECTADO');
    const desconexion = await historialEstadoDispositivoRepository.registrarEstado(dispositivo.id, 'DESCONECTADO');

    const ultimo = await historialEstadoDispositivoRepository.obtenerUltimoEstado(dispositivo.id);
    expect(ultimo.id).toBe(desconexion.id);
    expect(ultimo.estado).toBe('DESCONECTADO');
  });

  it('listarDispositivosInactivos detecta un dispositivo sin mediciones desde hace más de N minutos', async () => {
    const dispositivo = await crearDispositivo();
    await asignar(operario.id, dispositivo.id, new Date(Date.now() - 10 * 60 * 1000));

    const inactivos = await historialEstadoDispositivoRepository.listarDispositivosInactivos(5);
    expect(inactivos.map((d) => d.id_dispositivo)).toContain(dispositivo.id);
  });

  it('listarDispositivosInactivos no marca un dispositivo con mediciones recientes', async () => {
    const dispositivo = await crearDispositivo();
    await asignar(operario.id, dispositivo.id, new Date(Date.now() - 10 * 60 * 1000));
    await crearMedicion(operario.id, dispositivo.id, new Date());

    const inactivos = await historialEstadoDispositivoRepository.listarDispositivosInactivos(5);
    expect(inactivos.map((d) => d.id_dispositivo)).not.toContain(dispositivo.id);
  });

  it('listarDispositivosInactivos no repite un dispositivo ya marcado DESCONECTADO', async () => {
    const dispositivo = await crearDispositivo();
    await asignar(operario.id, dispositivo.id, new Date(Date.now() - 10 * 60 * 1000));
    await historialEstadoDispositivoRepository.registrarEstado(dispositivo.id, 'DESCONECTADO');

    const inactivos = await historialEstadoDispositivoRepository.listarDispositivosInactivos(5);
    expect(inactivos.map((d) => d.id_dispositivo)).not.toContain(dispositivo.id);
  });

  it('listarDispositivosInactivos ignora dispositivos sin asignación vigente', async () => {
    const dispositivo = await crearDispositivo();
    await asignar(operario.id, dispositivo.id, new Date(Date.now() - 20 * 60 * 1000));
    await db.query(
      'UPDATE asignacion_dispositivo SET fecha_hasta = $1 WHERE id_dispositivo = $2;',
      [new Date(Date.now() - 15 * 60 * 1000), dispositivo.id],
    );

    const inactivos = await historialEstadoDispositivoRepository.listarDispositivosInactivos(5);
    expect(inactivos.map((d) => d.id_dispositivo)).not.toContain(dispositivo.id);
  });

  it('listarEstadoActual devuelve todos los dispositivos con su último estado', async () => {
    const conEstado = await crearDispositivo();
    const sinEstado = await crearDispositivo();
    await historialEstadoDispositivoRepository.registrarEstado(conEstado.id, 'CONECTADO');

    const actual = await historialEstadoDispositivoRepository.listarEstadoActual();
    const filaConEstado = actual.find((d) => d.id === conEstado.id);
    const filaSinEstado = actual.find((d) => d.id === sinEstado.id);

    expect(filaConEstado.estado_conexion).toBe('CONECTADO');
    expect(filaSinEstado.estado_conexion).toBeNull();
  });
});
