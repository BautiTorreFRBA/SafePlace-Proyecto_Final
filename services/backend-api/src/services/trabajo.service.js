const trabajoRepository = require('../repositories/trabajo.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');

const TABLA_AFECTADA = 'trabajo';

function createHttpError(status, message, motivo) {
  const error = new Error(message);
  error.status = status;
  if (motivo) {
    error.motivo = motivo;
  }
  return error;
}

const esNumeroPositivo = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

// Mismo criterio de negocio que umbral_riesgo (H0023): los 6 umbrales son
// obligatorios y numéricos positivos.
const validarUmbrales = ({
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
};

const validarNombre = (nombre) => {
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    throw createHttpError(400, 'El nombre del trabajo es obligatorio.', 'TRABAJO_INVALIDO');
  }
};

const listar = async () => trabajoRepository.listar();

const listarActivos = async () => trabajoRepository.listarActivos();

const crear = async (datos, actor) => {
  validarNombre(datos.nombre);
  validarUmbrales(datos);

  const registro = await trabajoRepository.crear({
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
      detalle: `Trabajo "${registro.nombre}" creado (fatiga=${datos.fcFatiga}bpm/${datos.minutosFatiga}min, `
        + `sobreesfuerzo=${datos.fcSobreesfuerzo}bpm+act.${datos.actividadSobreesfuerzo}, `
        + `inactividad=${datos.minutosInactividad}min, desconexion_tolerada=${datos.minutosDesconexionTolerada}min).`,
    })
    .catch(() => {});

  return registro;
};

const actualizar = async (id, datos, actor) => {
  const existente = await trabajoRepository.obtenerPorId(id);
  if (!existente) {
    throw createHttpError(404, 'El trabajo no existe.', 'TRABAJO_NO_ENCONTRADO');
  }
  validarNombre(datos.nombre);
  validarUmbrales(datos);

  const registro = await trabajoRepository.actualizar(id, {
    ...datos,
    activo: datos.activo !== false,
    idUsuario: actor?.id,
  });

  await logAuditoriaRepository
    .registrar({
      idUsuario: actor?.id,
      tablaAfectada: TABLA_AFECTADA,
      idRegistro: registro.id,
      operacion: 'UPDATE',
      ipOrigen: actor?.ip,
      detalle: `Trabajo "${registro.nombre}" actualizado (activo=${registro.activo}).`,
    })
    .catch(() => {});

  return registro;
};

module.exports = {
  listar,
  listarActivos,
  crear,
  actualizar,
};
