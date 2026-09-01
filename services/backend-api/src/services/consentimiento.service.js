const operarioRepository = require('../repositories/operario.repository');
const registroConsentimientoRepository = require('../repositories/registroConsentimiento.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
const consentimientoCache = require('./validacion/consentimiento.cache');
const solicitudRepository = require('../repositories/solicitudConsentimiento.repository');
const emailService = require('./email.service');
const crypto = require('crypto');

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

  if (!trabajador.email) {
    throw createHttpError(400, 'El trabajador no tiene un email cargado.', 'EMAIL_TRABAJADOR_OBLIGATORIO');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const solicitud = await solicitudRepository.crear({
    idOperario: idTrabajador,
    tokenHash,
    versionPolitica,
    expiraEn,
  });
  const frontendUrl = process.env.FRONTEND_URL || 'https://safe-place-proyecto-final-web.vercel.app';
  const link = `${frontendUrl.replace(/\/$/, '')}/consentimiento-confirmacion.html?token=${token}`;

  await emailService.enviarSolicitudConsentimiento({
    email: trabajador.email,
    nombre: `${trabajador.nombre} ${trabajador.apellido}`.trim(),
    link,
    versionPolitica,
    expiraEn,
  });

  return { id: solicitud.id, estado: 'pendiente', email: trabajador.email, expira_en: solicitud.expira_en };
};

const confirmar = async (token) => {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    throw createHttpError(400, 'El enlace de consentimiento no es válido.', 'TOKEN_INVALIDO');
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const solicitud = await solicitudRepository.obtenerValidaPorToken(tokenHash);
  if (!solicitud) {
    throw createHttpError(410, 'El enlace es inválido, ya fue utilizado o expiró.', 'TOKEN_EXPIRADO');
  }
  const marcada = await solicitudRepository.marcarUsada(solicitud.id);
  if (!marcada) {
    throw createHttpError(410, 'El enlace ya fue utilizado o expiró.', 'TOKEN_EXPIRADO');
  }
  const registro = await registroConsentimientoRepository.crear({
    idOperario: solicitud.id_operario,
    estado: true,
    versionPolitica: solicitud.version_politica,
  });
  consentimientoCache.invalidar(solicitud.id_operario);
  await auditar({
    idRegistro: registro.id,
    operacion: 'OTORGAR_CONFIRMADO',
    detalle: `Confirmación por email del consentimiento del trabajador ${solicitud.id_operario} (política ${solicitud.version_politica}).`,
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
  confirmar,
  revocar,
  obtenerHistorial,
};
