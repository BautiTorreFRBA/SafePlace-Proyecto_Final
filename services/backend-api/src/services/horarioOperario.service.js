const horarioOperarioRepository = require('../repositories/horarioOperario.repository');
const operarioRepository = require('../repositories/operario.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');

const TABLA_AFECTADA = 'horario_operario';

function createHttpError(status, message, motivo) {
  const error = new Error(message);
  error.status = status;
  if (motivo) error.motivo = motivo;
  return error;
}

// "HH:MM" o "HH:MM:SS"
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

// Múltiples ventanas por día están permitidas (turnos partidos, distinto
// trabajo a la mañana y a la tarde, etc.) — lo único que no puede pasar es
// que se superpongan en el tiempo, porque obtenerVentanaVigente no podría
// resolver sin ambigüedad cuál aplica.
const seSuperponen = (a, b) => String(a.horaInicio) < String(b.horaFin) && String(b.horaInicio) < String(a.horaFin);

const validarVentanas = (ventanas) => {
  if (!Array.isArray(ventanas)) {
    throw createHttpError(400, 'Se espera un arreglo de ventanas horarias.', 'HORARIO_INVALIDO');
  }

  const porDia = new Map();
  for (const v of ventanas) {
    const dia = Number(v.diaSemana);
    if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
      throw createHttpError(400, 'diaSemana debe ser un entero de 1 (lunes) a 7 (domingo).', 'HORARIO_INVALIDO');
    }

    if (!RE_HORA.test(String(v.horaInicio)) || !RE_HORA.test(String(v.horaFin))) {
      throw createHttpError(400, 'horaInicio y horaFin deben tener formato HH:MM.', 'HORARIO_INVALIDO');
    }
    if (String(v.horaFin) <= String(v.horaInicio)) {
      throw createHttpError(400, 'horaFin debe ser posterior a horaInicio (turnos nocturnos no soportados).', 'HORARIO_INVALIDO');
    }

    if (v.idTrabajo != null && (!Number.isInteger(Number(v.idTrabajo)) || Number(v.idTrabajo) <= 0)) {
      throw createHttpError(400, 'idTrabajo debe ser un entero positivo o estar ausente (umbral global).', 'HORARIO_INVALIDO');
    }

    const otras = porDia.get(dia) || [];
    if (otras.some((otra) => seSuperponen(otra, v))) {
      throw createHttpError(400, `Hay ventanas horarias superpuestas para el día ${dia}.`, 'HORARIO_INVALIDO');
    }
    otras.push(v);
    porDia.set(dia, otras);
  }
};

const exigirOperario = async (idOperario) => {
  const operario = await operarioRepository.obtenerPorId(idOperario);
  if (!operario) {
    throw createHttpError(404, 'El operario no existe.', 'OPERARIO_NO_ENCONTRADO');
  }
  return operario;
};

// "YYYY-MM-DD"
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// La excepción puntual no valida superposición contra lo recurrente — a
// propósito lo reemplaza para esa fecha. Sólo no puede superponerse con
// otra excepción de la MISMA fecha.
const validarExcepcion = (datos, excepcionesExistentes) => {
  if (!RE_FECHA.test(String(datos.fecha)) || Number.isNaN(Date.parse(datos.fecha))) {
    throw createHttpError(400, 'fecha debe tener formato YYYY-MM-DD.', 'HORARIO_INVALIDO');
  }
  if (!RE_HORA.test(String(datos.horaInicio)) || !RE_HORA.test(String(datos.horaFin))) {
    throw createHttpError(400, 'horaInicio y horaFin deben tener formato HH:MM.', 'HORARIO_INVALIDO');
  }
  if (String(datos.horaFin) <= String(datos.horaInicio)) {
    throw createHttpError(400, 'horaFin debe ser posterior a horaInicio (turnos nocturnos no soportados).', 'HORARIO_INVALIDO');
  }
  if (datos.idTrabajo != null && (!Number.isInteger(Number(datos.idTrabajo)) || Number(datos.idTrabajo) <= 0)) {
    throw createHttpError(400, 'idTrabajo debe ser un entero positivo o estar ausente (umbral global).', 'HORARIO_INVALIDO');
  }

  const mismaFecha = excepcionesExistentes.filter((e) => String(e.fecha).slice(0, 10) === String(datos.fecha));
  if (mismaFecha.some((otra) => seSuperponen(
    { horaInicio: String(otra.hora_inicio).slice(0, 5), horaFin: String(otra.hora_fin).slice(0, 5) },
    datos,
  ))) {
    throw createHttpError(400, `Ya hay una excepción horaria superpuesta para el ${datos.fecha}.`, 'HORARIO_INVALIDO');
  }
};

const obtenerPorOperario = async (idOperario) => {
  await exigirOperario(idOperario);
  return horarioOperarioRepository.listarPorOperario(idOperario);
};

const configurar = async (idOperario, ventanas, actor) => {
  await exigirOperario(idOperario);
  validarVentanas(ventanas);

  const resultado = await horarioOperarioRepository.reemplazar(idOperario, ventanas);

  await logAuditoriaRepository
    .registrar({
      idUsuario: actor?.id,
      tablaAfectada: TABLA_AFECTADA,
      idRegistro: idOperario,
      operacion: 'UPDATE',
      ipOrigen: actor?.ip,
      detalle: `Horario laboral del operario ${idOperario} actualizado (${ventanas.length} ventana(s)).`,
    })
    .catch(() => {});

  return resultado;
};

const agregarExcepcion = async (idOperario, datos, actor) => {
  await exigirOperario(idOperario);
  const existentes = await horarioOperarioRepository.listarExcepcionesPorOperario(idOperario);
  validarExcepcion(datos, existentes);

  const registro = await horarioOperarioRepository.agregarExcepcion(idOperario, datos);

  await logAuditoriaRepository
    .registrar({
      idUsuario: actor?.id,
      tablaAfectada: TABLA_AFECTADA,
      idRegistro: idOperario,
      operacion: 'CREATE',
      ipOrigen: actor?.ip,
      detalle: `Excepción horaria del ${datos.fecha} agregada para el operario ${idOperario} `
        + `(${datos.horaInicio}-${datos.horaFin}).`,
    })
    .catch(() => {});

  return registro;
};

const eliminarExcepcion = async (idOperario, idExcepcion, actor) => {
  await exigirOperario(idOperario);
  const eliminada = await horarioOperarioRepository.eliminarExcepcion(idOperario, idExcepcion);
  if (!eliminada) {
    throw createHttpError(404, 'La excepción horaria no existe.', 'EXCEPCION_NO_ENCONTRADA');
  }

  await logAuditoriaRepository
    .registrar({
      idUsuario: actor?.id,
      tablaAfectada: TABLA_AFECTADA,
      idRegistro: idOperario,
      operacion: 'DELETE',
      ipOrigen: actor?.ip,
      detalle: `Excepción horaria ${idExcepcion} eliminada para el operario ${idOperario}.`,
    })
    .catch(() => {});

  return eliminada;
};

module.exports = {
  obtenerPorOperario,
  configurar,
  agregarExcepcion,
  eliminarExcepcion,
};
