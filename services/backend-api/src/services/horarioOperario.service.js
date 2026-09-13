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

const obtenerPorOperario = async (idOperario) => {
  const operario = await operarioRepository.obtenerPorId(idOperario);
  if (!operario) {
    throw createHttpError(404, 'El operario no existe.', 'OPERARIO_NO_ENCONTRADO');
  }
  return horarioOperarioRepository.listarPorOperario(idOperario);
};

const configurar = async (idOperario, ventanas, actor) => {
  const operario = await operarioRepository.obtenerPorId(idOperario);
  if (!operario) {
    throw createHttpError(404, 'El operario no existe.', 'OPERARIO_NO_ENCONTRADO');
  }
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

module.exports = {
  obtenerPorOperario,
  configurar,
};
