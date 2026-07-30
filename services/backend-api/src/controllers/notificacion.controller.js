const notificacionRepository = require('../repositories/notificacion.repository');
const eventBus = require('../utils/eventBus');

const HEARTBEAT_MS = 15000;

// H0015: "las notificaciones aparecen en el panel operativo... en tiempo
// cercano al real" — SSE: el backend empuja un aviso apenas el Motor de
// Reglas genera una notificación (eventBus), en vez de que el cliente
// haga polling. El evento no lleva payload: el cliente refetcha
// /notificaciones al recibirlo (mismo criterio que la bandeja de H0013,
// una sola fuente de verdad para la resolución de identidad/prioridad).
const stream = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  const enviarEvento = () => {
    res.write('event: notificacion\ndata: {}\n\n');
  };

  eventBus.on('notificacion:nueva', enviarEvento);

  // Keepalive: evita que el proxy de Render corte la conexión por
  // inactividad cuando no hay notificaciones nuevas por un rato.
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('notificacion:nueva', enviarEvento);
  });
};

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
  stream,
  listar,
  marcarLeida,
};
