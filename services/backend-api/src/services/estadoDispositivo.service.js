const historialEstadoDispositivoRepository = require('../repositories/historialEstadoDispositivo.repository');

/**
 * H0006: "si no se reciben datos durante más de 5 minutos, se registra
 * evento de desconexión". Es una inferencia sobre datos que el backend ya
 * tiene (no depende de que el hub reporte nada) — se corre periódicamente
 * desde server.js.
 *
 * CP-E2E-04 agrega la detección de "wearable congelado": varias mediciones
 * seguidas con exactamente la misma frecuencia cardíaca => también se
 * registra DESCONECTADO (ver historialEstadoDispositivo.listarDispositivosTrabados).
 */
const MINUTOS_INACTIVIDAD = Number(process.env.DESCONEXION_MINUTOS) || 5;

// Nº de lecturas consecutivas idénticas a partir del cual se considera que el
// wearable no está midiendo de verdad. A REPORT_INTERVAL=5s del hub, 12
// lecturas ≈ 1 minuto de pulso "congelado".
const REPETICIONES_TRABADO = Number(process.env.LECTURAS_TRABADAS_UMBRAL) || 12;

const chequearInactividad = async () => {
  const inactivos = await historialEstadoDispositivoRepository.listarDispositivosInactivos(
    MINUTOS_INACTIVIDAD,
  );

  for (const { id_dispositivo: idDispositivo } of inactivos) {
    await historialEstadoDispositivoRepository.registrarEstado(idDispositivo, 'DESCONECTADO');
  }

  return inactivos.length;
};

const chequearLecturasTrabadas = async () => {
  const trabados = await historialEstadoDispositivoRepository.listarDispositivosTrabados(
    REPETICIONES_TRABADO,
  );

  for (const { id_dispositivo: idDispositivo } of trabados) {
    await historialEstadoDispositivoRepository.registrarEstado(idDispositivo, 'DESCONECTADO');
  }

  return trabados.length;
};

module.exports = {
  chequearInactividad,
  chequearLecturasTrabadas,
  MINUTOS_INACTIVIDAD,
  REPETICIONES_TRABADO,
};
