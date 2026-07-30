const alertsRepository = require('../repositories/alerts.repository');
const alertaRepository = require('../repositories/alerta.repository');

// H0013: "cada alerta posee estado: Activa, Atendida o Cerrada" — el
// endpoint de cambio de estado sólo acepta pasar a Atendida/Cerrada; volver
// a Activa es responsabilidad exclusiva del Motor de Reglas, no de un PATCH.
const ESTADOS_PERMITIDOS_PATCH = ['Atendida', 'Cerrada'];

const normalizarFiltro = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getHistorialAlertas = async (req, res, next) => {
  try {
    const desde = normalizarFiltro(req.query.desde);
    if (!desde) {
      return res.status(400).json({
        error: 'La fecha desde es obligatoria.',
        motivo: 'FALTA_FILTRO_DESDE',
      });
    }

    const rows = await alertsRepository.listarHistorialAlertas({
      desde,
      tipo: normalizarFiltro(req.query.tipo),
      empleado: normalizarFiltro(req.query.empleado),
    });

    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const getAlertasActivas = async (req, res, next) => {
  try {
    const rows = await alertaRepository.listarActivas();
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const actualizarEstado = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body;

    if (!ESTADOS_PERMITIDOS_PATCH.includes(estado)) {
      return res.status(400).json({
        error: `estado debe ser uno de: ${ESTADOS_PERMITIDOS_PATCH.join(', ')}.`,
        motivo: 'ESTADO_INVALIDO',
      });
    }

    const existente = await alertaRepository.obtenerPorId(id);
    if (!existente) {
      return res.status(404).json({ error: 'La alerta no existe.', motivo: 'ALERTA_NO_ENCONTRADA' });
    }

    const actualizada = await alertaRepository.actualizarEstado(id, estado);
    res.json({ message: 'Estado de la alerta actualizado.', data: actualizada });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHistorialAlertas,
  getAlertasActivas,
  actualizarEstado,
};
