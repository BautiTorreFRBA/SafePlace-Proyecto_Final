const dispositivoRepository = require('../repositories/dispositivo.repository');
const historialEstadoDispositivoRepository = require('../repositories/historialEstadoDispositivo.repository');
const asignacionDispositivoRepository = require('../repositories/asignacionDispositivo.repository');
const inactividadProlongadaService = require('../services/inactividadProlongada.service');

const ESTADOS_VALIDOS = ['CONECTADO', 'DESCONECTADO', 'ERROR_CONEXION'];

// H0007: el hub identifica wearables por MAC BLE; el backend por id numérico.
// Este lookup es lo que permite al hub resolver el id real antes de mandar
// mediciones o eventos de conexión.
const lookupPorMac = async (req, res, next) => {
  try {
    const { mac } = req.query;
    if (!mac) {
      return res.status(400).json({
        error: 'El parámetro "mac" es obligatorio.',
        motivo: 'VALIDACION_DATOS',
      });
    }

    const dispositivo = await dispositivoRepository.obtenerPorMac(mac);
    if (!dispositivo) {
      return res.status(404).json({
        error: 'No hay ningún wearable registrado con esa dirección MAC.',
        motivo: 'DISPOSITIVO_NO_ENCONTRADO',
      });
    }

    res.status(200).json({ data: { id: dispositivo.id } });
  } catch (error) {
    next(error);
  }
};

// H0007: el hub reporta acá los eventos de conexión/desconexión/error que
// detecta en la conexión BLE (on_disconnect, reconexión exitosa, etc.).
const registrarEstadoConexion = async (req, res, next) => {
  try {
    const { estado } = req.body || {};
    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.`,
        motivo: 'VALIDACION_DATOS',
      });
    }

    const dispositivo = await dispositivoRepository.obtenerPorId(req.params.id);
    if (!dispositivo) {
      return res.status(404).json({
        error: 'El dispositivo no existe.',
        motivo: 'DISPOSITIVO_NO_ENCONTRADO',
      });
    }

    const registro = await historialEstadoDispositivoRepository.registrarEstado(
      req.params.id,
      estado,
    );

    // CP-E2E-04: al reconectar, la condición de inactividad prolongada dejó
    // de sostenerse — se cierran sus alertas Activas del operario asignado.
    if (estado === 'CONECTADO') {
      const asignacion = await asignacionDispositivoRepository
        .obtenerVigentePorDispositivo(Number(req.params.id));
      if (asignacion) {
        await inactividadProlongadaService
          .resolverPorReconexion(asignacion.id_trabajador)
          .catch((err) => console.error('[dispositivos.controller] cierre por reconexión:', err.message));
      }
    }

    res.status(201).json({ message: 'Estado de conexión registrado.', data: registro });
  } catch (error) {
    next(error);
  }
};

// H0007: "el estado de conexión es visible para el administrador".
const listarEstadoConexion = async (req, res, next) => {
  try {
    const estados = await historialEstadoDispositivoRepository.listarEstadoActual();
    res.status(200).json({ data: estados });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  lookupPorMac,
  registrarEstadoConexion,
  listarEstadoConexion,
};
