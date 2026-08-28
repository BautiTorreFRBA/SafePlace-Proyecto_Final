const umbralRiesgoRepository = require('../repositories/umbralRiesgo.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');

const TABLA_AFECTADA = 'umbral_riesgo';

function createHttpError(status, message, motivo) {
  const error = new Error(message);
  error.status = status;
  if (motivo) {
    error.motivo = motivo;
  }
  return error;
}

const esNumeroPositivo = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

// Minutos tras los cuales la inferencia de H0006 marca un wearable como
// DESCONECTADO. La tolerancia de inactividad prolongada (CP-E2E-04) debe ser
// mayor que esto: recién después de ese lapso existe el evento a partir del
// cual contar.
const DESCONEXION_MINUTOS = Number(process.env.DESCONEXION_MINUTOS) || 5;

// H0023: "se pueden definir umbrales de FC para fatiga/sobreesfuerzo y
// tiempos máximos de inactividad" — los 6 valores son obligatorios y
// numéricos positivos (un umbral en 0 o negativo no tiene sentido de
// negocio y dispararía alertas en cualquier medición).
const validarCampos = ({
  fcFatiga,
  minutosFatiga,
  fcSobreesfuerzo,
  actividadSobreesfuerzo,
  minutosInactividad,
  minutosDesconexionTolerada,
}) => {
  const campos = {
    fcFatiga,
    minutosFatiga,
    fcSobreesfuerzo,
    actividadSobreesfuerzo,
    minutosInactividad,
    minutosDesconexionTolerada,
  };

  const invalidos = Object.entries(campos)
    .filter(([, valor]) => !esNumeroPositivo(valor))
    .map(([nombre]) => nombre);

  if (invalidos.length > 0) {
    throw createHttpError(
      400,
      `Umbrales inválidos: deben ser números positivos (${invalidos.join(', ')}).`,
      'UMBRALES_INVALIDOS',
    );
  }

  if (minutosDesconexionTolerada <= DESCONEXION_MINUTOS) {
    throw createHttpError(
      400,
      `minutosDesconexionTolerada debe ser mayor que ${DESCONEXION_MINUTOS} (tiempo de inferencia de desconexión).`,
      'UMBRALES_INVALIDOS',
    );
  }
};

const configurar = async (datos, actor) => {
  validarCampos(datos);

  const registro = await umbralRiesgoRepository.crear({
    ...datos,
    idUsuario: actor?.id,
  });

  await logAuditoriaRepository
    .registrar({
      idUsuario: actor?.id,
      tablaAfectada: TABLA_AFECTADA,
      idRegistro: registro.id,
      operacion: 'CREATE',
      ipOrigen: actor?.ip,
      detalle: `Nuevos umbrales de riesgo configurados (fatiga=${datos.fcFatiga}bpm/${datos.minutosFatiga}min, `
        + `sobreesfuerzo=${datos.fcSobreesfuerzo}bpm+act.${datos.actividadSobreesfuerzo}, `
        + `inactividad=${datos.minutosInactividad}min, `
        + `desconexion_tolerada=${datos.minutosDesconexionTolerada}min).`,
    })
    .catch(() => {});

  return registro;
};

const obtenerVigente = async () => {
  return await umbralRiesgoRepository.obtenerVigente();
};

const obtenerHistorial = async () => {
  return await umbralRiesgoRepository.listarHistorial();
};

module.exports = {
  configurar,
  obtenerVigente,
  obtenerHistorial,
};
