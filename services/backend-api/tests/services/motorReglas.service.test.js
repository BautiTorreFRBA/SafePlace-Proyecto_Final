/**
 * Tests unitarios del Motor de Reglas (H0010 fatiga, H0011 sobreesfuerzo,
 * H0012 inactividad prolongada, centralización H0013). Repositorios
 * mockeados: acá se verifica la lógica de evaluación y orquestación en
 * aislamiento; el camino end-to-end contra Postgres real se cubre en
 * tests/integration/.
 */

jest.mock('../../src/repositories/medicion.repository');
jest.mock('../../src/repositories/umbralRiesgo.repository');
jest.mock('../../src/repositories/tipoAlerta.repository');
jest.mock('../../src/repositories/alerta.repository');
jest.mock('../../src/repositories/notificacion.repository');
jest.mock('../../src/repositories/logAuditoria.repository');

const medicionRepository = require('../../src/repositories/medicion.repository');
const umbralRiesgoRepository = require('../../src/repositories/umbralRiesgo.repository');
const tipoAlertaRepository = require('../../src/repositories/tipoAlerta.repository');
const alertaRepository = require('../../src/repositories/alerta.repository');
const notificacionRepository = require('../../src/repositories/notificacion.repository');
const logAuditoriaRepository = require('../../src/repositories/logAuditoria.repository');
const motorReglasService = require('../../src/services/reglas/motorReglas.service');

const UMBRAL = {
  fc_fatiga: 140,
  minutos_fatiga: 10,
  fc_sobreesfuerzo: 170,
  actividad_sobreesfuerzo: 0.8,
  minutos_inactividad: 30,
};

const TIPOS_MOCK = {
  FATIGA: { id: 1, nombre: 'FATIGA', prioridad: 'Media' },
  SOBREESFUERZO: { id: 2, nombre: 'SOBREESFUERZO', prioridad: 'Crítica' },
  INACTIVIDAD_PROLONGADA: { id: 3, nombre: 'INACTIVIDAD_PROLONGADA', prioridad: 'Media' },
};

const medicionMock = (overrides = {}) => ({
  id: 500,
  id_seudonimo: 7,
  id_dispositivo: 3,
  fecha_hora: new Date(),
  frecuencia_cardiaca: 80,
  actividad: '0.2',
  ...overrides,
});

// Ventana ya cumplida: la más antigua tiene `minutos` de antigüedad
// (+1 de margen) y todas cumplen la condición pasada.
const ventanaSostenida = (minutos, valorPorFila, cantidad = 3) => {
  const ahora = Date.now();
  return Array.from({ length: cantidad }, (_, i) => ({
    fecha_hora: new Date(ahora - (minutos + 1 - i) * 60 * 1000),
    frecuencia_cardiaca: valorPorFila,
    actividad: valorPorFila,
  }));
};

describe('motorReglas.service (H0010/H0011/H0012/H0013)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    umbralRiesgoRepository.obtenerVigente.mockResolvedValue(UMBRAL);
    tipoAlertaRepository.obtenerPorNombre.mockImplementation(async (nombre) => TIPOS_MOCK[nombre]);
    alertaRepository.existeActivaParaSeudonimoYTipo.mockResolvedValue(false);
    alertaRepository.crear.mockResolvedValue({ id: 900 });
    notificacionRepository.crear.mockResolvedValue({ id: 901 });
    logAuditoriaRepository.registrar.mockResolvedValue({ id: 1 });
    medicionRepository.listarVentanaReciente.mockResolvedValue([]);
  });

  it('sin umbral configurado (H0023 nunca corrido): no evalúa nada', async () => {
    umbralRiesgoRepository.obtenerVigente.mockResolvedValue(undefined);

    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 999 }));

    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('H0011 sobreesfuerzo: FC alta + actividad alta en la misma medición genera alerta', async () => {
    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 180, actividad: '0.9' }));

    expect(alertaRepository.crear).toHaveBeenCalledWith({ idTipoAlerta: 2, idMedicion: 500 });
    expect(notificacionRepository.crear).toHaveBeenCalledWith({ idAlerta: 900 });
  });

  it('H0011 sobreesfuerzo: no se dispara si sólo la FC está alta (actividad normal)', async () => {
    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 180, actividad: '0.1' }));

    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('H0011 sobreesfuerzo: actividad no numérica no genera falsa alerta', async () => {
    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 180, actividad: null }));

    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('H0010 fatiga: FC sostenida por encima del umbral durante el tiempo configurado genera alerta', async () => {
    medicionRepository.listarVentanaReciente.mockResolvedValue(ventanaSostenida(10, 150));

    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 150, actividad: null }));

    expect(alertaRepository.crear).toHaveBeenCalledWith({ idTipoAlerta: 1, idMedicion: 500 });
  });

  it('H0010 fatiga: no se dispara si la medición actual todavía no supera el umbral (corte rápido, sin consultar ventana)', async () => {
    // actividad '0.5' (no inactivo) para aislar el corte rápido de fatiga:
    // con actividad null, la propia regla de inactividad sí consultaría la
    // ventana (actividad desconocida se trata como potencial inactividad).
    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 100, actividad: '0.5' }));

    expect(medicionRepository.listarVentanaReciente).not.toHaveBeenCalled();
    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('H0010 fatiga: no se dispara si la ventana todavía no cubre el tiempo mínimo configurado', async () => {
    // Sólo 2 minutos de antigüedad, no los 10 configurados.
    medicionRepository.listarVentanaReciente.mockResolvedValue([
      { fecha_hora: new Date(Date.now() - 2 * 60 * 1000), frecuencia_cardiaca: 150 },
    ]);

    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 150, actividad: null }));

    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('H0010 fatiga: no se dispara si hubo un pico aislado por debajo del umbral dentro de la ventana', async () => {
    const ventana = ventanaSostenida(10, 150);
    ventana[1].frecuencia_cardiaca = 100; // rompe la condición sostenida
    medicionRepository.listarVentanaReciente.mockResolvedValue(ventana);

    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 150, actividad: null }));

    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('H0012 inactividad: sin movimiento sostenido durante el tiempo configurado genera alerta', async () => {
    medicionRepository.listarVentanaReciente.mockResolvedValue(
      ventanaSostenida(30, 0).map((m) => ({ ...m, actividad: 0 })),
    );

    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 80, actividad: '0' }));

    expect(alertaRepository.crear).toHaveBeenCalledWith({ idTipoAlerta: 3, idMedicion: 500 });
  });

  it('H0012 inactividad: no se dispara si la medición actual ya tiene actividad', async () => {
    await motorReglasService.evaluar(medicionMock({ actividad: '0.5' }));

    expect(medicionRepository.listarVentanaReciente).toHaveBeenCalledTimes(0);
    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('H0013 antiduplicado: no genera una alerta nueva si ya hay una Activa para el mismo tipo y trabajador', async () => {
    alertaRepository.existeActivaParaSeudonimoYTipo.mockResolvedValue(true);

    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 180, actividad: '0.9' }));

    expect(alertaRepository.crear).not.toHaveBeenCalled();
    expect(notificacionRepository.crear).not.toHaveBeenCalled();
  });

  it('si tipo_alerta no existe (seed faltante), no rompe y no crea nada', async () => {
    tipoAlertaRepository.obtenerPorNombre.mockResolvedValue(undefined);

    await expect(
      motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 180, actividad: '0.9' })),
    ).resolves.not.toThrow();
    expect(alertaRepository.crear).not.toHaveBeenCalled();
  });

  it('puede detectar más de un tipo de riesgo para la misma medición (p.ej. fatiga + sobreesfuerzo)', async () => {
    medicionRepository.listarVentanaReciente.mockResolvedValue(ventanaSostenida(10, 180));

    await motorReglasService.evaluar(medicionMock({ frecuencia_cardiaca: 180, actividad: '0.9' }));

    expect(alertaRepository.crear).toHaveBeenCalledWith({ idTipoAlerta: 2, idMedicion: 500 }); // sobreesfuerzo
    expect(alertaRepository.crear).toHaveBeenCalledWith({ idTipoAlerta: 1, idMedicion: 500 }); // fatiga
    expect(alertaRepository.crear).toHaveBeenCalledTimes(2);
  });
});
