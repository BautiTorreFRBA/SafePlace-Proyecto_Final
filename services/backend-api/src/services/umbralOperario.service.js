const umbralOperarioRepository = require('../repositories/umbralOperario.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
const operarioRepository = require('../repositories/operario.repository');

const TABLA_AFECTADA = 'operario';

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

const noEncontrada = () => createHttpError(
  404,
  'El operario no tiene configuración particular.',
  'UMBRAL_OPERARIO_NO_ENCONTRADO',
);

const listar = async () => umbralOperarioRepository.listar();

const crear = async (datos, actor) => {
  await validar(datos);
  if (await umbralOperarioRepository.obtenerPorOperario(datos.idOperario)) {
    throw createHttpError(
      409,
      'Ese operario ya tiene una configuración particular. Editala desde la tabla.',
      'UMBRAL_OPERARIO_DUPLICADO',
    );
  }

  const registro = await umbralOperarioRepository.guardar(datos.idOperario, datos);
  await auditar(
    actor,
    registro,
    'UPDATE',
    `Configuración particular creada para el operario ${registro.id} `
      + `(fatiga=${registro.fc_fatiga}bpm, sobreesfuerzo=${registro.fc_sobreesfuerzo}bpm).`,
  );
  return registro;
};

// La configuración particular se identifica por el id del operario.
const actualizar = async (idOperario, datos, actor) => {
  if (!(await umbralOperarioRepository.obtenerPorOperario(idOperario))) throw noEncontrada();
  await validar({ ...datos, idOperario });

  const registro = await umbralOperarioRepository.guardar(idOperario, datos);
  await auditar(
    actor,
    registro,
    'UPDATE',
    `Configuración particular del operario ${registro.id} actualizada `
      + `(fatiga=${registro.fc_fatiga}bpm, sobreesfuerzo=${registro.fc_sobreesfuerzo}bpm).`,
  );
  return registro;
};

const eliminar = async (idOperario, actor) => {
  const registro = await umbralOperarioRepository.eliminar(idOperario);
  if (!registro) throw noEncontrada();
  await auditar(
    actor,
    registro,
    'UPDATE',
    `Configuración particular del operario ${registro.id} eliminada (vuelve al umbral global).`,
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
