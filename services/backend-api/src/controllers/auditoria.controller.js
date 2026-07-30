const logAuditoriaRepository = require('../repositories/logAuditoria.repository');

const LIMIT_DEFAULT = 50;
const LIMIT_MAXIMO = 200;

function createHttpError(status, message, motivo) {
  const error = new Error(message);
  error.status = status;
  if (motivo) {
    error.motivo = motivo;
  }
  return error;
}

const parseFiltros = (query) => {
  const filtros = {};

  if (query.usuario !== undefined && query.usuario !== '') {
    const idUsuario = Number(query.usuario);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw createHttpError(400, 'El filtro "usuario" debe ser un id numérico válido.', 'VALIDACION_DATOS');
    }
    filtros.idUsuario = idUsuario;
  }

  if (query.operacion) {
    filtros.operacion = String(query.operacion);
  }

  if (query.desde) {
    const fechaDesde = new Date(query.desde);
    if (Number.isNaN(fechaDesde.getTime())) {
      throw createHttpError(400, 'El filtro "desde" no es una fecha válida.', 'VALIDACION_DATOS');
    }
    filtros.fechaDesde = fechaDesde;
  }

  if (query.hasta) {
    const fechaHasta = new Date(query.hasta);
    if (Number.isNaN(fechaHasta.getTime())) {
      throw createHttpError(400, 'El filtro "hasta" no es una fecha válida.', 'VALIDACION_DATOS');
    }
    filtros.fechaHasta = fechaHasta;
  }

  const limit = query.limit !== undefined ? Number(query.limit) : LIMIT_DEFAULT;
  if (!Number.isInteger(limit) || limit <= 0 || limit > LIMIT_MAXIMO) {
    throw createHttpError(400, `El parámetro "limit" debe ser un entero entre 1 y ${LIMIT_MAXIMO}.`, 'VALIDACION_DATOS');
  }
  filtros.limit = limit;

  const offset = query.offset !== undefined ? Number(query.offset) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw createHttpError(400, 'El parámetro "offset" debe ser un entero mayor o igual a 0.', 'VALIDACION_DATOS');
  }
  filtros.offset = offset;

  return filtros;
};

const listar = async (req, res, next) => {
  try {
    const filtros = parseFiltros(req.query || {});

    const [registros, total] = await Promise.all([
      logAuditoriaRepository.listar(filtros),
      logAuditoriaRepository.contar(filtros),
    ]);

    res.status(200).json({
      data: registros,
      total,
      limit: filtros.limit,
      offset: filtros.offset,
    });
  } catch (error) {
    next(error);
  }
};

// El registro de auditoría es append-only (criterio de aceptación H0021):
// no admite edición ni borrado desde la interfaz. Se responde 403 explícito
// en vez de dejar que la ruta caiga en un 404, para que el bloqueo sea un
// contrato verificable y no un accidente de enrutamiento.
const bloquearModificacion = (req, res) => {
  res.status(403).json({
    error: 'El registro de auditoría es de solo lectura: no admite edición ni eliminación.',
    motivo: 'AUDITORIA_INMUTABLE',
  });
};

module.exports = {
  listar,
  bloquearModificacion,
};
