const dispositivoRepository = require('../repositories/dispositivo.repository');

const listar = async (req, res, next) => {
  try {
    const wearables = await dispositivoRepository.listarDisponibles();
    res.status(200).json({ data: wearables });
  } catch (error) {
    next(error);
  }
};

// H0007: setea la dirección MAC BLE del wearable, prerequisito para que el
// hub pueda resolver el dispositivo.id real vía GET /dispositivos/lookup.
const actualizarMac = async (req, res, next) => {
  try {
    const { direccionMac } = req.body || {};
    if (!direccionMac) {
      return res.status(400).json({
        error: 'direccionMac es obligatoria.',
        motivo: 'VALIDACION_DATOS',
      });
    }

    const dispositivo = await dispositivoRepository.obtenerPorId(req.params.id);
    if (!dispositivo) {
      return res.status(404).json({
        error: 'El wearable no existe.',
        motivo: 'DISPOSITIVO_NO_ENCONTRADO',
      });
    }

    const actualizado = await dispositivoRepository.actualizarMac(req.params.id, direccionMac);
    res.status(200).json({ message: 'Dirección MAC actualizada.', data: actualizado });
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      return res.status(409).json({
        error: 'Esa dirección MAC ya está asignada a otro wearable.',
        motivo: 'MAC_DUPLICADA',
      });
    }
    next(error);
  }
};

module.exports = {
  listar,
  actualizarMac,
};
