const medicionesHistorialRepository = require('../repositories/mediciones.historial.repository');

const normalizarFiltro = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getHistorialMediciones = async (req, res, next) => {
  try {
    const desde = normalizarFiltro(req.query.desde);
    const hasta = normalizarFiltro(req.query.hasta);

    if (!desde || !hasta) {
      return res.status(400).json({
        error: 'Las fechas desde y hasta son obligatorias.',
        motivo: 'FALTAN_FILTROS_FECHA',
      });
    }

    const [rows, validacion] = await Promise.all([
      medicionesHistorialRepository.listarHistorialMediciones({
        desde,
        hasta,
        empleado: normalizarFiltro(req.query.empleado),
        limit: req.query.limit ? Number(req.query.limit) : 200,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      }),
      // Resultado del Servicio de Validación de Datos para el período (S1):
      // no se filtra por empleado (el descarte se audita sin identidad).
      medicionesHistorialRepository.resumenValidacion({ desde, hasta }),
    ]);

    res.json({ data: rows, validacion });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHistorialMediciones,
};
