const alertsRepository = require('../repositories/alerts.repository');

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

module.exports = {
  getHistorialAlertas,
};
