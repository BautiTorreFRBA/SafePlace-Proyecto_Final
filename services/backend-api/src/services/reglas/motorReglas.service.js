const medicionRepository = require('../../repositories/medicion.repository');
const umbralRiesgoRepository = require('../../repositories/umbralRiesgo.repository');
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

// Una condición está "sostenida" cuando la ventana de mediciones recientes
// ya cubre el tiempo mínimo configurado (la más antigua tiene esa
// antigüedad) y TODAS las mediciones de la ventana cumplen la condición.
const sostenidaEnVentana = (ventana, minutos, cumpleCondicion) => {
  if (ventana.length === 0) return false;

  const masAntigua = new Date(ventana[0].fecha_hora).getTime();
  const antiguedadMs = Date.now() - masAntigua;
  if (antiguedadMs < minutos * 60 * 1000) return false;

  return ventana.every(cumpleCondicion);
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
  const umbral = await umbralRiesgoRepository.obtenerVigente();
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
