const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const umbralRiesgoRepository = require('../../src/repositories/umbralRiesgo.repository');

const umbralMock = (overrides = {}) => ({
  fcFatiga: 140,
  minutosFatiga: 10,
  fcSobreesfuerzo: 170,
  actividadSobreesfuerzo: 0.8,
  minutosInactividad: 30,
  minutosDesconexionTolerada: 10,
  idUsuario: null,
  ...overrides,
});

describe('umbralRiesgo.repository (H0023)', () => {
  beforeEach(async () => {
    await truncarTodo();
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('obtenerVigente devuelve undefined si nunca se configuró nada', async () => {
    const vigente = await umbralRiesgoRepository.obtenerVigente();
    expect(vigente).toBeUndefined();
  });

  it('crea una versión y la devuelve como vigente', async () => {
    const creado = await umbralRiesgoRepository.crear(umbralMock());

    expect(creado).toMatchObject({
      fc_fatiga: 140,
      minutos_fatiga: 10,
      fc_sobreesfuerzo: 170,
      minutos_inactividad: 30,
    });
    expect(Number(creado.actividad_sobreesfuerzo)).toBeCloseTo(0.8);

    const vigente = await umbralRiesgoRepository.obtenerVigente();
    expect(vigente.id).toBe(creado.id);
  });

  it('es append-only: una nueva configuración no pisa la anterior, la vigente es siempre la más reciente', async () => {
    const primero = await umbralRiesgoRepository.crear(umbralMock({ fcFatiga: 140 }));
    const segundo = await umbralRiesgoRepository.crear(umbralMock({ fcFatiga: 150 }));

    const vigente = await umbralRiesgoRepository.obtenerVigente();
    expect(vigente.id).toBe(segundo.id);
    expect(vigente.fc_fatiga).toBe(150);

    const historial = await umbralRiesgoRepository.listarHistorial();
    expect(historial.map((h) => h.id)).toEqual([segundo.id, primero.id]);
  });
});
