const tipoAlertaRepository = require('../repositories/tipoAlerta.repository');
const alertaRepository = require('../repositories/alerta.repository');
const notificacionRepository = require('../repositories/notificacion.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
const eventBus = require('../utils/eventBus');

// EMERGENCIA ("super alerta"): se dispara al generar cualquier otra alerta cuando,
// dentro de la ventana, el mismo operario (por seudónimo):
//  - pasó de FATIGA o SOBREESFUERZO a INACTIVIDAD_PROLONGADA (posible caída o
//    desmayo tras un episodio de riesgo), o
//  - acumula ALERTAS_PARA_EMERGENCIA alertas o más (reincidencia).
const TIPO_EMERGENCIA = 'EMERGENCIA';
const VENTANA_EMERGENCIA_MIN = 60;
const ALERTAS_PARA_EMERGENCIA = 3;
const TIPOS_PREVIOS_A_INACTIVIDAD = ['FATIGA', 'SOBREESFUERZO'];

// Devuelve el motivo de la emergencia (texto para auditoría) o null si no
// corresponde. La alerta recién creada ya está en la ventana.
const motivoEmergencia = async (idSeudonimo, nombreTipoNuevo) => {
  const tipos = (await alertaRepository.listarTiposEnVentana(idSeudonimo, VENTANA_EMERGENCIA_MIN)) || [];
  const previas = tipos.filter((nombre) => nombre !== TIPO_EMERGENCIA);

  if (
    nombreTipoNuevo === 'INACTIVIDAD_PROLONGADA'
    && previas.some((nombre) => TIPOS_PREVIOS_A_INACTIVIDAD.includes(nombre))
  ) {
    return `inactividad prolongada tras fatiga/sobreesfuerzo en los últimos ${VENTANA_EMERGENCIA_MIN} min`;
  }
  if (previas.length >= ALERTAS_PARA_EMERGENCIA) {
    return `${previas.length} alertas en los últimos ${VENTANA_EMERGENCIA_MIN} min`;
  }
  return null;
};

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

  if (nombreTipo !== TIPO_EMERGENCIA) {
    // Best-effort: un fallo al escalar no debe perder la alerta ya creada.
    try {
      const motivo = await motivoEmergencia(idSeudonimo, nombreTipo);
      if (motivo) {
        await generar({
          nombreTipo: TIPO_EMERGENCIA,
          idSeudonimo,
          detalle: `EMERGENCIA para el seudónimo ${idSeudonimo}: ${motivo}.`,
        });
      }
    } catch (err) {
      console.error('[alertas.service] No se pudo evaluar la escalada a EMERGENCIA:', err.message);
    }
  }

  return alerta;
};

module.exports = {
  generar,
  TIPO_EMERGENCIA,
  VENTANA_EMERGENCIA_MIN,
  ALERTAS_PARA_EMERGENCIA,
};
