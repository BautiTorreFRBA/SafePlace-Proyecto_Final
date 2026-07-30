const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const { empresaMock, trabajadorMock } = require('../fixtures/mockEntities');
const empresaRepository = require('../../src/repositories/empresa.repository');
const operarioRepository = require('../../src/repositories/operario.repository');
const operarioSeudonimoRepository = require('../../src/repositories/operarioSeudonimo.repository');

describe('operarioSeudonimo.repository (H0020)', () => {
  let trabajador;

  beforeEach(async () => {
    await truncarTodo();
    const empresa = await empresaRepository.crear(empresaMock());
    trabajador = await operarioRepository.crear(trabajadorMock(empresa.id));
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('crea un seudónimo la primera vez que se pide para un operario', async () => {
    const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);

    expect(seudonimo.id_operario).toBe(trabajador.id);
    expect(seudonimo.identificador_seudonimo).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reutiliza siempre el mismo seudónimo para el mismo operario (criterio: correspondencia estable)', async () => {
    const primero = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);
    const segundo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);

    expect(segundo.id).toBe(primero.id);
    expect(segundo.identificador_seudonimo).toBe(primero.identificador_seudonimo);
  });

  it('genera identificadores distintos para operarios distintos', async () => {
    const empresa2 = await empresaRepository.crear(empresaMock());
    const trabajador2 = await operarioRepository.crear(trabajadorMock(empresa2.id));

    const seudonimo1 = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);
    const seudonimo2 = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador2.id);

    expect(seudonimo1.identificador_seudonimo).not.toBe(seudonimo2.identificador_seudonimo);
  });

  it('obtenerPorOperario no crea nada: devuelve undefined si el operario no tiene seudónimo aún', async () => {
    const encontrado = await operarioSeudonimoRepository.obtenerPorOperario(trabajador.id);
    expect(encontrado).toBeUndefined();
  });

  it('resolverOperarioPorSeudonimo recupera la identidad civil a partir del seudónimo (tabla protegida)', async () => {
    const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(trabajador.id);

    const operario = await operarioSeudonimoRepository.resolverOperarioPorSeudonimo(seudonimo.id);

    expect(operario.id).toBe(trabajador.id);
    expect(operario.nombre).toBe(trabajador.nombre);
  });
});
