const dispositivoRepository = require('../repositories/dispositivo.repository');

const listar = async (req, res, next) => {
  try {
    const wearables = await dispositivoRepository.listarDisponibles();
    res.status(200).json({ data: wearables });
  } catch (error) {
    next(error);
  }
};

// "AA:BB:CC:DD:EE:FF", con o sin separadores. Misma tolerancia que el hub
// (que también normaliza mayúsculas antes de resolver por MAC).
const RE_MAC = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

// Alta de un wearable físico nuevo en el inventario. La MAC es opcional acá
// (un dispositivo puede recibirse antes de saber su dirección BLE definitiva)
// y se puede cargar/editar después con PATCH /wearables/:id — mismo campo,
// mismo flujo que ya usa esta pantalla.
const crear = async (req, res, next) => {
  try {
    const { marca, modelo, direccionMac } = req.body || {};

    if (!marca || !String(marca).trim() || !modelo || !String(modelo).trim()) {
      return res.status(400).json({
        error: 'marca y modelo son obligatorios.',
        motivo: 'VALIDACION_DATOS',
      });
    }

    const macNormalizada = direccionMac ? String(direccionMac).trim().toUpperCase() : null;
    if (macNormalizada && !RE_MAC.test(macNormalizada)) {
      return res.status(400).json({
        error: 'direccionMac debe tener formato AA:BB:CC:DD:EE:FF.',
        motivo: 'VALIDACION_DATOS',
      });
    }

    const dispositivo = await dispositivoRepository.crear({
      marca: String(marca).trim(),
      modelo: String(modelo).trim(),
      direccionMac: macNormalizada,
    });
    res.status(201).json({ message: 'Wearable creado.', data: dispositivo });
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
  crear,
  actualizarMac,
};
