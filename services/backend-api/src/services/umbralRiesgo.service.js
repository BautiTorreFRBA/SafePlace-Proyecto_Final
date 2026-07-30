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

// H0023: "se pueden definir umbrales de FC para fatiga/sobreesfuerzo y
// tiempos máximos de inactividad" — los 5 valores son obligatorios y
// numéricos positivos (un umbral en 0 o negativo no tiene sentido de
// negocio y dispararía alertas en cualquier medición).
const validarCampos = ({
  fcFatiga,
  minutosFatiga,
  fcSobreesfuerzo,
  actividadSobreesfuerzo,
  minutosInactividad,
}) => {
  const campos = {
    fcFatiga,
    minutosFatiga,
    fcSobreesfuerzo,
    actividadSobreesfuerzo,
    minutosInactividad,
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
        + `inactividad=${datos.minutosInactividad}min).`,
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
