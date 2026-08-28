const tipoAlertaRepository = require('../repositories/tipoAlerta.repository');
const alertaRepository = require('../repositories/alerta.repository');
const notificacionRepository = require('../repositories/notificacion.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
const eventBus = require('../utils/eventBus');

/**
 * Creación centralizada de alertas + notificación (H0013 / H0015).
 *
 * Reúne lo que antes estaba embebido en motorReglas.generarAlerta para que
 * lo compartan el Motor de Reglas (alertas ancladas a una medición: fatiga,
 * sobreesfuerzo) y el servicio de inactividad prolongada (alertas ancladas
 * sólo al seudónimo: wearable desconectado en horario laboral, CP-E2E-04).
 *
 * Incluye el chequeo antiduplicado ("no se generan alertas duplicadas para
 * una misma condición activa") y auditoría best-effort.
 */
const generar = async ({
  nombreTipo,
  idSeudonimo,
  idMedicion = null,
  detalle,
}) => {
  const tipoAlerta = await tipoAlertaRepository.obtenerPorNombre(nombreTipo);
  if (!tipoAlerta) {
    console.error(`[alertas.service] tipo_alerta "${nombreTipo}" no existe — revisar el seed de la migración.`);
    return null;
  }

  const yaActiva = await alertaRepository.existeActivaParaSeudonimoYTipo(
    idSeudonimo,
    tipoAlerta.id,
  );
  if (yaActiva) return null;

  const alerta = await alertaRepository.crear({
    idTipoAlerta: tipoAlerta.id,
    idMedicion,
    idSeudonimo,
  });
  await notificacionRepository.crear({ idAlerta: alerta.id });

  // H0015: aviso al panel operativo vía SSE — el listener sólo dispara un
  // refetch de /notificaciones.
  eventBus.emit('notificacion:nueva');

  await logAuditoriaRepository
    .registrar({
      idUsuario: null, // origen: sistema (motor de reglas / chequeo de conexión), no un usuario humano
      tablaAfectada: 'alerta',
      idRegistro: alerta.id,
      operacion: 'CREATE',
      detalle: detalle
        || `Alerta ${nombreTipo} generada para el seudónimo ${idSeudonimo}.`,
    })
    .catch((err) => {
      console.error('[alertas.service] No se pudo auditar la alerta generada:', err.message);
    });

  return alerta;
};

module.exports = {
  generar,
};
