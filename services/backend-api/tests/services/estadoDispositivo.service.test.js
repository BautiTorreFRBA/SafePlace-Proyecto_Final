jest.mock('../../src/repositories/historialEstadoDispositivo.repository');

const historialEstadoDispositivoRepository = require('../../src/repositories/historialEstadoDispositivo.repository');
const estadoDispositivoService = require('../../src/services/estadoDispositivo.service');

describe('estadoDispositivo.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registra DESCONECTADO para cada dispositivo inactivo detectado', async () => {
    historialEstadoDispositivoRepository.listarDispositivosInactivos.mockResolvedValue([
      { id_dispositivo: 1 },
      { id_dispositivo: 2 },
    ]);
    historialEstadoDispositivoRepository.registrarEstado.mockResolvedValue({ id: 1 });

    const cantidad = await estadoDispositivoService.chequearInactividad();

    expect(cantidad).toBe(2);
    expect(historialEstadoDispositivoRepository.registrarEstado).toHaveBeenCalledWith(1, 'DESCONECTADO');
    expect(historialEstadoDispositivoRepository.registrarEstado).toHaveBeenCalledWith(2, 'DESCONECTADO');
  });

  it('no registra nada si no hay dispositivos inactivos', async () => {
    historialEstadoDispositivoRepository.listarDispositivosInactivos.mockResolvedValue([]);

    const cantidad = await estadoDispositivoService.chequearInactividad();

    expect(cantidad).toBe(0);
    expect(historialEstadoDispositivoRepository.registrarEstado).not.toHaveBeenCalled();
  });
});
