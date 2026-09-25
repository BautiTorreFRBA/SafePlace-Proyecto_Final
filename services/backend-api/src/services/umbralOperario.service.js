const umbralOperarioRepository = require('../repositories/umbralOperario.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
const operarioRepository = require('../repositories/operario.repository');

const TABLA_AFECTADA = 'umbral_operario';

function createHttpError(status, message, motivo) {
  const error = new Error(message);
  error.status = status;
  if (motivo) {
    error.motivo = motivo;
  }
  return error;
}

// Mismo rango que acepta un pulso humano medido por el wearable; evita que un
// typo (p. ej. 1400) deje al operario sin alertas en la práctica.
const FC_MIN = 30;
const FC_MAX = 250;
const esFcValida = (v) => Number.isInteger(v) && v >= FC_MIN && v <= FC_MAX;

const validar = async ({ idOperario, fcFatiga, fcSobreesfuerzo }) => {
  if (!Number.isInteger(idOperario) || idOperario <= 0) {
    throw createHttpError(400, 'Hay que elegir un operario de la lista.', 'OPERARIO_INVALIDO');
  }
  const invalidos = Object.entries({ fcFatiga, fcSobreesfuerzo })
    .filter(([, valor]) => !esFcValida(valor))
    .map(([nombre]) => nombre);
  if (invalidos.length > 0) {
    throw createHttpError(
      400,
      `Frecuencias inválidas: deben ser enteros entre ${FC_MIN} y ${FC_MAX} BPM (${invalidos.join(', ')}).`,
      'UMBRALES_INVALIDOS',
    );
  }
  const operario = await operarioRepository.obtenerPorId(idOperario);
  if (!operario) {
    throw createHttpError(404, 'El operario no existe.', 'OPERARIO_NO_ENCONTRADO');
  }
};

const asegurarUnicoPorOperario = async (idOperario, idPropio = null) => {
  const existente = await umbralOperarioRepository.obtenerPorOperario(idOperario);
  if (existente && existente.id !== idPropio) {
    throw createHttpError(
      409,
      'Ese operario ya tiene una configuración particular. Editala desde la tabla.',
      'UMBRAL_OPERARIO_DUPLICADO',
    );
  }
};

const auditar = (actor, registro, operacion, detalle) => logAuditoriaRepository
  .registrar({
    idUsuario: actor?.id,
    tablaAfectada: TABLA_AFECTADA,
    idRegistro: registro.id,
    operacion,
    ipOrigen: actor?.ip,
    detalle,
  })
  .catch(() => {});

const listar = async () => umbralOperarioRepository.listar();

const crear = async (datos, actor) => {
  await validar(datos);
  await asegurarUnicoPorOperario(datos.idOperario);

  const registro = await umbralOperarioRepository.crear({ ...datos, idUsuario: actor?.id });
  await auditar(
    actor,
    registro,
    'CREATE',
    `Configuración particular creada para el operario ${registro.id_operario} `
      + `(fatiga=${registro.fc_fatiga}bpm, sobreesfuerzo=${registro.fc_sobreesfuerzo}bpm).`,
  );
  return registro;
};

const actualizar = async (id, datos, actor) => {
  const existente = await umbralOperarioRepository.obtenerPorId(id);
  if (!existente) {
    throw createHttpError(404, 'La configuración particular no existe.', 'UMBRAL_OPERARIO_NO_ENCONTRADO');
  }
  await validar(datos);
  await asegurarUnicoPorOperario(datos.idOperario, existente.id);

  const registro = await umbralOperarioRepository.actualizar(id, { ...datos, idUsuario: actor?.id });
  await auditar(
    actor,
    registro,
    'UPDATE',
    `Configuración particular del operario ${registro.id_operario} actualizada `
      + `(fatiga=${registro.fc_fatiga}bpm, sobreesfuerzo=${registro.fc_sobreesfuerzo}bpm).`,
  );
  return registro;
};

const eliminar = async (id, actor) => {
  const registro = await umbralOperarioRepository.eliminar(id);
  if (!registro) {
    throw createHttpError(404, 'La configuración particular no existe.', 'UMBRAL_OPERARIO_NO_ENCONTRADO');
  }
  await auditar(
    actor,
    registro,
    'DELETE',
    `Configuración particular del operario ${registro.id_operario} eliminada (vuelve al umbral global).`,
  );
  return registro;
};

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar,
  FC_MIN,
  FC_MAX,
};
