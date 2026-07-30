const operarioRepository = require('../repositories/operario.repository');
const dispositivoRepository = require('../repositories/dispositivo.repository');
const asignacionRepository = require('../repositories/asignacionDispositivo.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');

const TABLA_AFECTADA = 'asignacion_dispositivo';

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

const crear = async ({ idTrabajador, idDispositivo, fechaDesde }, actor) => {
  if (!idTrabajador || !idDispositivo) {
    throw createHttpError(400, 'idTrabajador e idDispositivo son obligatorios.', 'VALIDACION_DATOS');
  }

  const trabajador = await operarioRepository.obtenerPorId(idTrabajador);
  if (!trabajador) {
    throw createHttpError(404, 'El trabajador no existe.', 'TRABAJADOR_NO_ENCONTRADO');
  }
  if (trabajador.estado !== true) {
    throw createHttpError(
      409,
      'Un wearable sólo puede asociarse a un trabajador activo.',
      'TRABAJADOR_INACTIVO',
    );
  }

  const dispositivo = await dispositivoRepository.obtenerPorId(idDispositivo);
  if (!dispositivo) {
    throw createHttpError(404, 'El wearable no existe.', 'DISPOSITIVO_NO_ENCONTRADO');
  }

  const vigente = await asignacionRepository.obtenerVigentePorDispositivo(idDispositivo);
  if (vigente) {
    throw createHttpError(
      409,
      'El wearable ya está asignado a un trabajador.',
      'WEARABLE_YA_ASIGNADO',
    );
  }

  const asignacion = await asignacionRepository.crear({
    idTrabajador,
    idDispositivo,
    fechaDesde,
  });

  await auditar({
    actor,
    idRegistro: asignacion.id,
    operacion: 'CREATE',
    detalle: `Asociación del wearable ${idDispositivo} al trabajador ${idTrabajador}.`,
  });

  return asignacion;
};

const actualizar = async (id, { fechaDesde, fechaHasta }, actor) => {
  const asignacion = await asignacionRepository.obtenerPorId(id);
  if (!asignacion) {
    throw createHttpError(404, 'La asociación no existe.', 'ASOCIACION_NO_ENCONTRADA');
  }

  const actualizada = await asignacionRepository.actualizar(id, { fechaDesde, fechaHasta });

  await auditar({
    actor,
    idRegistro: id,
    operacion: 'UPDATE',
    detalle: 'Modificación de la asociación wearable-trabajador.',
  });

  return actualizada;
};

const finalizar = async (id, actor) => {
  const asignacion = await asignacionRepository.obtenerPorId(id);
  if (!asignacion) {
    throw createHttpError(404, 'La asociación no existe.', 'ASOCIACION_NO_ENCONTRADA');
  }
  if (asignacion.fecha_hasta && new Date(asignacion.fecha_hasta) <= new Date()) {
    throw createHttpError(409, 'La asociación ya está finalizada.', 'ASOCIACION_YA_FINALIZADA');
  }

  const finalizada = await asignacionRepository.finalizar(id);

  await auditar({
    actor,
    idRegistro: id,
    operacion: 'FINALIZAR',
    detalle: 'Finalización de la asociación wearable-trabajador.',
  });

  return finalizada;
};

module.exports = {
  crear,
  actualizar,
  finalizar,
};
