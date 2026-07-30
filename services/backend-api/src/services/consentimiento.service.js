const operarioRepository = require('../repositories/operario.repository');
const registroConsentimientoRepository = require('../repositories/registroConsentimiento.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
const consentimientoCache = require('./validacion/consentimiento.cache');

const TABLA_AFECTADA = 'registro_consentimiento';

function createHttpError(status, message, motivo) {
  const error = new Error(message);
  error.status = status;
  if (motivo) {
    error.motivo = motivo;
  }
  return error;
}

const auditar = ({ actor, idRegistro, operacion, detalle }) => logAuditoriaRepository
  .registrar({
    idUsuario: actor?.id,
    tablaAfectada: TABLA_AFECTADA,
    idRegistro,
    operacion,
    ipOrigen: actor?.ip,
    detalle,
  })
  .catch(() => {});

const otorgar = async ({ idTrabajador, versionPolitica }, actor) => {
  if (!idTrabajador || !versionPolitica) {
    throw createHttpError(
      400,
      'idTrabajador y versionPolitica son obligatorios.',
      'VALIDACION_DATOS',
    );
  }

  const trabajador = await operarioRepository.obtenerPorId(idTrabajador);
  if (!trabajador) {
    throw createHttpError(404, 'El trabajador no existe.', 'TRABAJADOR_NO_ENCONTRADO');
  }

  const registro = await registroConsentimientoRepository.crear({
    idOperario: idTrabajador,
    estado: true,
    versionPolitica,
  });

  consentimientoCache.invalidar(idTrabajador);

  await auditar({
    actor,
    idRegistro: registro.id,
    operacion: 'OTORGAR',
    detalle: `Otorgamiento de consentimiento del trabajador ${idTrabajador} (política ${versionPolitica}).`,
  });

  return registro;
};

const revocar = async (idTrabajador, actor) => {
  if (!idTrabajador) {
    throw createHttpError(400, 'idTrabajador es obligatorio.', 'VALIDACION_DATOS');
  }

  const trabajador = await operarioRepository.obtenerPorId(idTrabajador);
  if (!trabajador) {
    throw createHttpError(404, 'El trabajador no existe.', 'TRABAJADOR_NO_ENCONTRADO');
  }

  const vigente = await registroConsentimientoRepository.obtenerVigente(idTrabajador);
  if (!vigente || vigente.estado !== true) {
    throw createHttpError(
      409,
      'El trabajador no tiene un consentimiento vigente para revocar.',
      'CONSENTIMIENTO_NO_VIGENTE',
    );
  }

  const registro = await registroConsentimientoRepository.crear({
    idOperario: idTrabajador,
    estado: false,
    versionPolitica: vigente.version_politica,
  });

  consentimientoCache.invalidar(idTrabajador);

  await auditar({
    actor,
    idRegistro: registro.id,
    operacion: 'REVOCAR',
    detalle: `Revocación de consentimiento del trabajador ${idTrabajador}.`,
  });

  return registro;
};

const obtenerHistorial = async (idTrabajador) => {
  const trabajador = await operarioRepository.obtenerPorId(idTrabajador);
  if (!trabajador) {
    throw createHttpError(404, 'El trabajador no existe.', 'TRABAJADOR_NO_ENCONTRADO');
  }

  return registroConsentimientoRepository.listarPorTrabajador(idTrabajador);
};

module.exports = {
  otorgar,
  revocar,
  obtenerHistorial,
};
