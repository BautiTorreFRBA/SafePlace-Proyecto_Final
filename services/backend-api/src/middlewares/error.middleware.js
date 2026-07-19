const validacionDatosService = require('../services/validacion/validacion-datos.service');

// Global error handler
function errorHandler(err, req, res, next) {
  // JSON corrupto rechazado por express.json() (RF-04 "paquetes corruptos").
  // Si ocurrió en el endpoint de ingesta de mediciones, el descarte se audita
  // (H0008) de forma best-effort, sin bloquear la respuesta.
  if (err.type === 'entity.parse.failed') {
    if (req.method === 'POST' && req.originalUrl.startsWith('/api/v1/mediciones')) {
      validacionDatosService
        .auditarPaqueteCorrupto({
          ipOrigen: req.ip,
          cuerpoCrudo: req.rawBody ? req.rawBody.toString('utf8') : '',
        })
        .catch(() => {});
    }
    return res.status(400).json({
      error: 'JSON inválido',
      motivo: 'ESTRUCTURA_INVALIDA',
      message: 'El cuerpo de la solicitud no es JSON válido.',
    });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error(err.stack);
    return res.status(status).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }

  // Errores operacionales (validación de datos, etc.): status y motivo tipados.
  return res.status(status).json({
    error: err.message,
    ...(err.motivo ? { motivo: err.motivo } : {}),
  });
}

module.exports = errorHandler;
