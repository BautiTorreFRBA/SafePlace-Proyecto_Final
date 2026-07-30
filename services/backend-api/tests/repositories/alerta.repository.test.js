const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const { empresaMock, trabajadorMock, dispositivoMock, medicionMock } = require('../fixtures/mockEntities');
const empresaRepository = require('../../src/repositories/empresa.repository');
const operarioRepository = require('../../src/repositories/operario.repository');
const dispositivoRepository = require('../../src/repositories/dispositivo.repository');
const medicionRepository = require('../../src/repositories/medicion.repository');
const operarioSeudonimoRepository = require('../../src/repositories/operarioSeudonimo.repository');
const tipoAlertaRepository = require('../../src/repositories/tipoAlerta.repository');
const alertaRepository = require('../../src/repositories/alerta.repository');

describe('alerta.repository (H0013)', () => {
  let trabajador;
  let seudonimo;
  let medicion;
  let tipoFatiga;

  beforeEach(async () => {
    await truncarTodo();
    const empresa = await empresaRepository.crear(empresaMock());
    trabajador = await operarioRepository.crear(trabajadorMock(empresa.id));
    const dispositivo = await dispositivoRepository.crear(dispositivoMock());
    seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);
    medicion = await medicionRepository.crear(medicionMock(seudonimo.id, dispositivo.id));
    tipoFatiga = await tipoAlertaRepository.obtenerPorNombre('FATIGA');
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('crea una alerta con estado Activa por default', async () => {
    const alerta = await alertaRepository.crear({ idTipoAlerta: tipoFatiga.id, idMedicion: medicion.id });

    expect(alerta.estado).toBe('Activa');
    expect(alerta.id_tipo_alerta).toBe(tipoFatiga.id);
    expect(alerta.id_medicion).toBe(medicion.id);
  });

  it('existeActivaParaSeudonimoYTipo detecta la condición sostenida (antiduplicado de H0013)', async () => {
    expect(await alertaRepository.existeActivaParaSeudonimoYTipo(seudonimo.id, tipoFatiga.id)).toBe(false);

    const alerta = await alertaRepository.crear({ idTipoAlerta: tipoFatiga.id, idMedicion: medicion.id });
    expect(await alertaRepository.existeActivaParaSeudonimoYTipo(seudonimo.id, tipoFatiga.id)).toBe(true);

    await alertaRepository.actualizarEstado(alerta.id, 'Cerrada');
    expect(await alertaRepository.existeActivaParaSeudonimoYTipo(seudonimo.id, tipoFatiga.id)).toBe(false);
  });

  it('actualizarEstado transiciona Activa -> Atendida -> Cerrada', async () => {
    const alerta = await alertaRepository.crear({ idTipoAlerta: tipoFatiga.id, idMedicion: medicion.id });

    const atendida = await alertaRepository.actualizarEstado(alerta.id, 'Atendida');
    expect(atendida.estado).toBe('Atendida');

    const cerrada = await alertaRepository.actualizarEstado(alerta.id, 'Cerrada');
    expect(cerrada.estado).toBe('Cerrada');
  });

  it('listarActivas devuelve sólo alertas Activas, con la identidad reidentificada', async () => {
    const activa = await alertaRepository.crear({ idTipoAlerta: tipoFatiga.id, idMedicion: medicion.id });
    const otra = await alertaRepository.crear({ idTipoAlerta: tipoFatiga.id, idMedicion: medicion.id });
    await alertaRepository.actualizarEstado(otra.id, 'Cerrada');

    const activas = await alertaRepository.listarActivas();

    expect(activas.map((a) => a.id)).toEqual([activa.id]);
    expect(activas[0]).toMatchObject({
      tipo_alerta: 'FATIGA',
      prioridad: 'Media',
      id_trabajador: trabajador.id,
      operario_nombre: trabajador.nombre,
      operario_apellido: trabajador.apellido,
    });
  });

  it('obtenerPorId devuelve undefined si no existe', async () => {
    expect(await alertaRepository.obtenerPorId(999999)).toBeUndefined();
  });
});
