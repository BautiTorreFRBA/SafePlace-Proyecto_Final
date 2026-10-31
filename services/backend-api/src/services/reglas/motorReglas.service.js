const medicionRepository = require('../../repositories/medicion.repository');
const umbralEfectivoService = require('../umbralEfectivo.service');
const alertasService = require('../alertas.service');

/**
 * Motor de Reglas por medición (H0010 fatiga, H0011 sobreesfuerzo). Se
 * dispara una vez por cada medición válida ya persistida (enganchado desde
 * mediciones.service.registrarMedicion).
 *
 * H0012 (inactividad prolongada) YA NO se evalúa acá: se reencuadró como
 * "wearable desconectado durante el horario laboral del operario por más que
 * la tolerancia configurada" y vive en inactividadProlongada.service.js,
 * disparado por el chequeo periódico de server.js — no por una medición.
 *
 * Evalúa todo por id_seudonimo, nunca por identidad civil (H0020).
 */

const TIPOS = {
  FATIGA: 'FATIGA',
  SOBREESFUERZO: 'SOBREESFUERZO',
};

const aNumero = (valor) => {
  if (valor === null || valor === undefined) return null;
  const n = Number(valor);
  return Number.isNaN(n) ? null : n;
};

// Una condición está "sostenida" cuando hay mediciones que cubren el tiempo
// mínimo configurado y TODAS las de ese período cumplen la condición.
//
// La consulta trae un margen extra (MARGEN_VENTANA_SEGUNDOS) para absorber el
// intervalo de reporte del gateway y garantizar que la ventana quede cubierta.
// Ese margen sirve sólo para eso: la condición se evalúa únicamente sobre el
// período configurado. Incluirlo en el `every` exigía `minutos + margen` de
// condición sostenida — con ventanas cortas eso duplicaba el tiempo pedido
// (0.5 min configurados exigían 60 s reales) y la alerta no saltaba.
const sostenidaEnVentana = (ventana, minutos, cumpleCondicion) => {
  if (ventana.length === 0) return false;

  const desde = Date.now() - minutos * 60 * 1000;
  // La más antigua tiene que ser anterior al inicio del período: si no, todavía
  // no hay historia suficiente para afirmar que la condición se sostuvo.
  if (new Date(ventana[0].fecha_hora).getTime() > desde) return false;

  const delPeriodo = ventana.filter((m) => new Date(m.fecha_hora).getTime() >= desde);
  return delPeriodo.length > 0 && delPeriodo.every(cumpleCondicion);
};

// H0010: FC sostenida por encima del umbral durante el tiempo configurado.
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
// alta simultáneas, sin ventana de tiempo. `actividad` la aporta el proxy
// derivado de FC del gateway (escala 0..1).
const evaluarSobreesfuerzo = (medicion, umbral) => {
  const fc = aNumero(medicion.frecuencia_cardiaca);
  const actividad = aNumero(medicion.actividad);
  if (fc === null || actividad === null) return false;

  return fc >= umbral.fc_sobreesfuerzo && actividad >= Number(umbral.actividad_sobreesfuerzo);
};

// Punto de entrada: evalúa una medición ya persistida contra las reglas por
// medición. Sin umbral configurado (H0023 nunca corrido) no hay contra qué
// evaluar.
const evaluar = async (medicion) => {
  const umbral = await umbralEfectivoService.resolverPorSeudonimo(
    medicion.id_seudonimo,
    new Date(medicion.fecha_hora),
  );
  if (!umbral) return;

  if (evaluarSobreesfuerzo(medicion, umbral)) {
    await alertasService.generar({
      nombreTipo: TIPOS.SOBREESFUERZO,
      idSeudonimo: medicion.id_seudonimo,
      idMedicion: medicion.id,
      detalle: `Alerta SOBREESFUERZO generada para el seudónimo ${medicion.id_seudonimo} (medición ${medicion.id}).`,
    });
  }
  if (await evaluarFatiga(medicion, umbral)) {
    await alertasService.generar({
      nombreTipo: TIPOS.FATIGA,
      idSeudonimo: medicion.id_seudonimo,
      idMedicion: medicion.id,
      detalle: `Alerta FATIGA generada para el seudónimo ${medicion.id_seudonimo} (medición ${medicion.id}).`,
    });
  }
};

module.exports = {
  evaluar,
  TIPOS,
};
