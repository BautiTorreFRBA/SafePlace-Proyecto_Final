const { truncarTodo, cerrarPool } = require('../helpers/testDb');
const trabajoRepository = require('../../src/repositories/trabajo.repository');

const trabajoMock = (overrides = {}) => ({
  nombre: 'Soldadura',
  descripcion: 'Tareas de soldadura en planta',
  fcFatiga: 130,
  minutosFatiga: 8,
  fcSobreesfuerzo: 165,
  actividadSobreesfuerzo: 0.75,
  minutosInactividad: 20,
  minutosDesconexionTolerada: 8,
  idUsuario: null,
  ...overrides,
});

describe('trabajo.repository', () => {
  beforeEach(async () => {
    await truncarTodo();
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('listar/listarActivos devuelven vacío sin trabajos creados', async () => {
    expect(await trabajoRepository.listar()).toEqual([]);
    expect(await trabajoRepository.listarActivos()).toEqual([]);
  });

  it('crea un trabajo activo por defecto', async () => {
    const creado = await trabajoRepository.crear(trabajoMock());

    expect(creado).toMatchObject({
      nombre: 'Soldadura',
      activo: true,
      fc_fatiga: 130,
      minutos_fatiga: 8,
      fc_sobreesfuerzo: 165,
      minutos_inactividad: 20,
      minutos_desconexion_tolerada: 8,
    });
    expect(Number(creado.actividad_sobreesfuerzo)).toBeCloseTo(0.75);

    expect(await trabajoRepository.obtenerPorId(creado.id)).toMatchObject({ id: creado.id });
    expect(await trabajoRepository.listarActivos()).toHaveLength(1);
  });

  it('actualizar edita in-place (no crea una versión nueva)', async () => {
    const creado = await trabajoRepository.crear(trabajoMock());

    const actualizado = await trabajoRepository.actualizar(creado.id, trabajoMock({
      nombre: 'Soldadura pesada',
      fcFatiga: 120,
      activo: false,
    }));

    expect(actualizado.id).toBe(creado.id);
    expect(actualizado.nombre).toBe('Soldadura pesada');
    expect(actualizado.fc_fatiga).toBe(120);
    expect(actualizado.activo).toBe(false);
    expect(await trabajoRepository.listar()).toHaveLength(1);
    expect(await trabajoRepository.listarActivos()).toHaveLength(0);
  });
});
