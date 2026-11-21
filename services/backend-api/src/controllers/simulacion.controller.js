const simulacionRepository = require('../repositories/simulacion.repository');
const simulacionLatido = require('../services/simulacionLatido.service');

const obtenerEstado = async (req, res, next) => {
  try {
    const estado = await simulacionRepository.obtenerEstado();
    res.json({ data: { activa: estado.simulacion_activa } });
  } catch (error) {
    next(error);
  }
};

const actualizarEstado = async (req, res, next) => {
  try {
    const { activa } = req.body ?? {};
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ error: '"activa" debe ser true o false.' });
    }
    const estado = await simulacionRepository.actualizarEstado(activa, req.usuario?.id ?? null);
    res.json({ data: { activa: estado.simulacion_activa } });
  } catch (error) {
    next(error);
  }
};

const listarOperarios = async (_req, res, next) => {
  try {
    res.json({ data: await simulacionRepository.listarOperariosSimulados() });
  } catch (error) {
    next(error);
  }
};

// El simulador de demo late en cada ciclo con el cuadro que esta inyectando.
// Entra con la API key del gateway, igual que las mediciones: no tiene JWT.
const registrarLatido = async (req, res, next) => {
  try {
    const { cuadro, bpm = null, idDispositivo = null, apagar = false } = req.body ?? {};

    if (apagar === true) {
      return res.json({ data: simulacionLatido.apagar() });
    }

    if (!simulacionLatido.CUADROS.includes(cuadro)) {
      return res.status(400).json({
        error: `"cuadro" debe ser uno de: ${simulacionLatido.CUADROS.join(', ')}.`,
      });
    }

    const bpmNum = bpm == null ? null : Number(bpm);
    if (bpmNum != null && !Number.isFinite(bpmNum)) {
      return res.status(400).json({ error: '"bpm" debe ser numerico.' });
    }

    const idNum = idDispositivo == null ? null : Number(idDispositivo);
    if (idNum != null && !Number.isInteger(idNum)) {
      return res.status(400).json({ error: '"idDispositivo" debe ser entero.' });
    }

    res.json({ data: simulacionLatido.registrar({ cuadro, bpm: bpmNum, idDispositivo: idNum }) });
  } catch (error) {
    next(error);
  }
};

// Lo consulta el frontend para pintar la luna. Se vence solo (ver el servicio),
// asi que no hace falta que nadie avise cuando el simulador se corta de golpe.
const obtenerLatido = async (_req, res, next) => {
  try {
    res.json({ data: simulacionLatido.estado() });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  obtenerEstado,
  actualizarEstado,
  listarOperarios,
  registrarLatido,
  obtenerLatido,
};
