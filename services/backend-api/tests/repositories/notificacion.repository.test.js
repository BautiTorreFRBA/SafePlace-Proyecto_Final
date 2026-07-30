const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const { empresaMock, trabajadorMock, dispositivoMock, medicionMock } = require('../fixtures/mockEntities');
const empresaRepository = require('../../src/repositories/empresa.repository');
const operarioRepository = require('../../src/repositories/operario.repository');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const medicionRepository = require('../../src/repositories/medicion.repository');
const operarioSeudonimoRepository = require('../../src/repositories/operarioSeudonimo.repository');
const tipoAlertaRepository = require('../../src/repositories/tipoAlerta.repository');
const alertaRepository = require('../../src/repositories/alerta.repository');
const notificacionRepository = require('../../src/repositories/notificacion.repository');

describe('notificacion.repository (H0015)', () => {
  let alerta;

  beforeEach(async () => {
    await truncarTodo();
    const empresa = await empresaRepository.crear(empresaMock());
    const trabajador = await operarioRepository.crear(trabajadorMock(empresa.id));
    const dispositivo = await dispositivoRepository.crear(dispositivoMock());
    const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);
    const medicion = await medicionRepository.crear(medicionMock(seudonimo.id, dispositivo.id));
    const tipoAlerta = await tipoAlertaRepository.obtenerPorNombre('SOBREESFUERZO');
    alerta = await alertaRepository.crear({ idTipoAlerta: tipoAlerta.id, idMedicion: medicion.id });
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('crea una notificación no leída por default', async () => {
    const notif = await notificacionRepository.crear({ idAlerta: alerta.id });

    expect(notif.id_alerta).toBe(alerta.id);
    expect(notif.leida).toBe(false);
    expect(notif.fecha_lectura).toBeNull();
  });

  it('listar devuelve todas por default, y sólo las no leídas con soloNoLeidas', async () => {
    const n1 = await notificacionRepository.crear({ idAlerta: alerta.id });
    await notificacionRepository.marcarLeida(n1.id);
    const n2 = await notificacionRepository.crear({ idAlerta: alerta.id });

    const todas = await notificacionRepository.listar();
    expect(todas.map((n) => n.id).sort()).toEqual([n1.id, n2.id].sort());

    const noLeidas = await notificacionRepository.listar({ soloNoLeidas: true });
    expect(noLeidas.map((n) => n.id)).toEqual([n2.id]);
  });

  it('listar incluye el tipo de alerta y la identidad reidentificada', async () => {
    await notificacionRepository.crear({ idAlerta: alerta.id });

    const [notif] = await notificacionRepository.listar();
    expect(notif.tipo_alerta).toBe('SOBREESFUERZO');
    expect(notif.prioridad).toBe('Crítica');
    expect(notif.operario_nombre).toBeDefined();
  });

  it('marcarLeida setea leida=true y fecha_lectura', async () => {
    const notif = await notificacionRepository.crear({ idAlerta: alerta.id });

    const leida = await notificacionRepository.marcarLeida(notif.id);
    expect(leida.leida).toBe(true);
    expect(leida.fecha_lectura).not.toBeNull();
  });

  it('marcarLeida devuelve undefined si la notificación no existe', async () => {
    expect(await notificacionRepository.marcarLeida(999999)).toBeUndefined();
  });
});
