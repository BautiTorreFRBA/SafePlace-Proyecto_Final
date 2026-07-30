const notificacionRepository = require('../repositories/notificacion.repository');

// H0015: "las notificaciones aparecen en el panel operativo" — el frontend
// hace polling de este endpoint (no hay WebSockets/SSE en el proyecto).
const listar = async (req, res, next) => {
  try {
    const soloNoLeidas = req.query.leida === 'false';
    const rows = await notificacionRepository.listar({ soloNoLeidas });
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const marcarLeida = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actualizada = await notificacionRepository.marcarLeida(id);

    if (!actualizada) {
      return res.status(404).json({ error: 'La notificación no existe.', motivo: 'NOTIFICACION_NO_ENCONTRADA' });
    }

    res.json({ message: 'Notificación marcada como leída.', data: actualizada });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
  marcarLeida,
};
