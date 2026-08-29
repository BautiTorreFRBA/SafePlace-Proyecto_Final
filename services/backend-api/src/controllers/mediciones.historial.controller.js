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

    const empleado = normalizarFiltro(req.query.empleado);
    const bucket = normalizarFiltro(req.query.bucket);

    // Fase 2 / S2: detalle de un empleado como serie temporal submuestreada.
    if (bucket) {
      const bucketSegundos = medicionesHistorialRepository.BUCKETS_VALIDOS[bucket];
      if (!bucketSegundos) {
        return res.status(400).json({
          error: 'El parámetro "bucket" debe ser 10s, 1m o 5m.',
          motivo: 'BUCKET_INVALIDO',
        });
      }

      const serie = await medicionesHistorialRepository.listarSerieMediciones({
        desde,
        hasta,
        empleado,
        bucketSegundos,
      });
      return res.json({ data: serie, bucket });
    }

    // Sin bucket: filas crudas para la tabla paginada del detalle.
    const rows = await medicionesHistorialRepository.listarHistorialMediciones({
      desde,
      hasta,
      empleado,
      limit: req.query.limit ? Number(req.query.limit) : 200,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });

    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

// Fase 2 / S2: vista maestro — una fila por empleado para el rango, más el
// resumen de validación del período (misma tarjeta que ya usaba el historial).
const getResumenMediciones = async (req, res, next) => {
  try {
    const desde = normalizarFiltro(req.query.desde);
    const hasta = normalizarFiltro(req.query.hasta);

    if (!desde || !hasta) {
      return res.status(400).json({
        error: 'Las fechas desde y hasta son obligatorias.',
        motivo: 'FALTAN_FILTROS_FECHA',
      });
    }

    const [data, validacion] = await Promise.all([
      medicionesHistorialRepository.resumenPorEmpleado({
        desde,
        hasta,
        empleado: normalizarFiltro(req.query.empleado),
      }),
      medicionesHistorialRepository.resumenValidacion({ desde, hasta }),
    ]);

    res.json({ data, validacion });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHistorialMediciones,
  getResumenMediciones,
};
