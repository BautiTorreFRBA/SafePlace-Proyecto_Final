const medicionRepository = require('../../repositories/medicion.repository');
const umbralRiesgoRepository = require('../../repositories/umbralRiesgo.repository');
const tipoAlertaRepository = require('../../repositories/tipoAlerta.repository');
const alertaRepository = require('../../repositories/alerta.repository');
const notificacionRepository = require('../../repositories/notificacion.repository');
const logAuditoriaRepository = require('../../repositories/logAuditoria.repository');
const eventBus = require('../../utils/eventBus');

/**
 * Motor de Reglas (H0010 fatiga, H0011 sobreesfuerzo, H0012 inactividad
 * prolongada, centralizadas en H0013). Se dispara una vez por cada medición
 * válida ya persistida (enganchado desde mediciones.service.registrarMedicion).
 *
 * Evalúa todo por id_seudonimo, nunca por identidad civil — coherente con
 * H0020: ninguna regla necesita saber quién es el trabajador, sólo "la misma
 * serie de mediciones". La identidad se resuelve recién al mostrar la
 * bandeja de alertas (alerta.repository/dashboard.repository), no acá.
 */

const TIPOS = {
  FATIGA: 'FATIGA',
  SOBREESFUERZO: 'SOBREESFUERZO',
  INACTIVIDAD: 'INACTIVIDAD_PROLONGADA',
};

// H0012: "no se registra movimiento" — H0023 sólo permite configurar el
// tiempo de inactividad, no un umbral de actividad aparte, así que el corte
// de "sin movimiento" es fijo (mismo criterio que usa H0006 para el
// dispositivo: ausencia de señal, acá ausencia de actividad reportada).
const NIVEL_SIN_MOVIMIENTO = 0;

const aNumero = (valor) => {
  if (valor === null || valor === undefined) return null;
  const n = Number(valor);
  return Number.isNaN(n) ? null : n;
};

// Una condición está "sostenida" cuando la ventana de mediciones recientes
// ya cubre el tiempo mínimo configurado (la más antigua tiene esa
// antigüedad) y TODAS las mediciones de la ventana cumplen la condición —
// no alcanza con picos aislados dentro del período.
const sostenidaEnVentana = (ventana, minutos, cumpleCondicion) => {
  if (ventana.length === 0) return false;

  const masAntigua = new Date(ventana[0].fecha_hora).getTime();
  const antiguedadMs = Date.now() - masAntigua;
  if (antiguedadMs < minutos * 60 * 1000) return false;

  return ventana.every(cumpleCondicion);
};

// H0010: FC sostenida por encima del umbral durante el tiempo configurado.
// Corte rápido sobre la medición recién llegada antes de ir a buscar la
// ventana completa (evita una consulta extra en el camino normal).
const evaluarFatiga = async (medicion, umbral) => {
  const fc = aNumero(medicion.frecuencia_cardiaca);
  if (fc === null || fc < umbral.fc_fatiga) return false;

  const ventana = await medicionRepository.listarVentanaReciente(
    medicion.id_seudonimo,
    umbral.minutos_fatiga,
  );
  return sostenidaEnVentana(ventana, umbral.minutos_fatiga, (m) => {
    const fcVentana = aNumero(m.frecuencia_cardiaca);
    return fcVentana !== null && fcVentana >= umbral.fc_fatiga;
  });
};

// H0011: puntual, sobre la medición recién llegada — FC alta Y actividad
// alta simultáneas, sin ventana de tiempo.
const evaluarSobreesfuerzo = (medicion, umbral) => {
  const fc = aNumero(medicion.frecuencia_cardiaca);
  const actividad = aNumero(medicion.actividad);
  if (fc === null || actividad === null) return false;

  return fc >= umbral.fc_sobreesfuerzo && actividad >= Number(umbral.actividad_sobreesfuerzo);
};

// H0012: sin movimiento sostenido durante el tiempo configurado — mismo
// mecanismo de ventana que la fatiga, pero sobre el nivel de actividad.
const evaluarInactividad = async (medicion, umbral) => {
  const actividad = aNumero(medicion.actividad);
  if (actividad !== null && actividad > NIVEL_SIN_MOVIMIENTO) return false;

  const ventana = await medicionRepository.listarVentanaReciente(
    medicion.id_seudonimo,
    umbral.minutos_inactividad,
  );
  return sostenidaEnVentana(ventana, umbral.minutos_inactividad, (m) => {
    const actividadVentana = aNumero(m.actividad);
    return actividadVentana === null || actividadVentana <= NIVEL_SIN_MOVIMIENTO;
  });
};

// H0013: centraliza la creación de alerta + notificación, con el chequeo
// antiduplicado ("no se generan alertas duplicadas para una misma condición
// activa") y auditoría best-effort de la creación.
const generarAlerta = async (nombreTipo, medicion) => {
  const tipoAlerta = await tipoAlertaRepository.obtenerPorNombre(nombreTipo);
  if (!tipoAlerta) {
    console.error(`[motorReglas] tipo_alerta "${nombreTipo}" no existe — revisar el seed de la migración.`);
    return;
  }

  const yaActiva = await alertaRepository.existeActivaParaSeudonimoYTipo(
    medicion.id_seudonimo,
    tipoAlerta.id,
  );
  if (yaActiva) return;

  const alerta = await alertaRepository.crear({
    idTipoAlerta: tipoAlerta.id,
    idMedicion: medicion.id,
  });
  await notificacionRepository.crear({ idAlerta: alerta.id });

  // H0015: aviso al panel operativo vía SSE — el listener sólo dispara un
  // refetch de /notificaciones, así el bus no duplica la resolución de
  // identidad (operario/prioridad) que ya hace notificacion.repository.listar.
  eventBus.emit('notificacion:nueva');

  await logAuditoriaRepository
    .registrar({
      idUsuario: null, // origen: Motor de Reglas, no un usuario humano
      tablaAfectada: 'alerta',
      idRegistro: alerta.id,
      operacion: 'CREATE',
      detalle: `Alerta ${nombreTipo} generada para el seudónimo ${medicion.id_seudonimo} (medición ${medicion.id}).`,
    })
    .catch((err) => {
      console.error('[motorReglas] No se pudo auditar la alerta generada:', err.message);
    });
};

// Punto de entrada: evalúa una medición ya persistida contra las 3 reglas.
// Sin umbral configurado (H0023 nunca corrido) no hay contra qué evaluar.
const evaluar = async (medicion) => {
  const umbral = await umbralRiesgoRepository.obtenerVigente();
  if (!umbral) return;

  if (evaluarSobreesfuerzo(medicion, umbral)) {
    await generarAlerta(TIPOS.SOBREESFUERZO, medicion);
  }
  if (await evaluarFatiga(medicion, umbral)) {
    await generarAlerta(TIPOS.FATIGA, medicion);
  }
  if (await evaluarInactividad(medicion, umbral)) {
    await generarAlerta(TIPOS.INACTIVIDAD, medicion);
  }
};

module.exports = {
  evaluar,
  TIPOS,
};
