/**
 * Latido del simulador de demo (scripts-demo/SafePlace-Simulador.ps1).
 *
 * El script manda un latido en cada ciclo con el cuadro que está inyectando.
 * El frontend lo consulta para pintar la luna del supervisor, así se ve de un
 * vistazo si la simulación está corriendo y en qué estado.
 *
 * Vive EN MEMORIA a propósito, no en la base:
 *  - es estado efímero de una demo, no un dato del negocio que haya que auditar;
 *  - evita una migración y un campo más en config_sistema;
 *  - si la API se reinicia o Render la duerme, arranca apagado, que es
 *    exactamente lo que queremos.
 *
 * El vencimiento es lo que lo hace confiable: si el script se corta de golpe
 * (Stop-Process, cierre de la ventana, se cae la red) no alcanza a avisar, pero
 * deja de latir y a los TTL_MS se apaga solo. Por eso el latido es continuo y
 * no un simple "prendido/apagado".
 */

// Tres latidos perdidos con el intervalo por defecto del simulador (5s).
const TTL_MS = 15000;

const CUADROS = ['normal', 'fatiga', 'sobreesfuerzo', 'inactividad'];

const APAGADO = { activa: false, cuadro: null, bpm: null, idDispositivo: null, haceMs: null };

let ultimo = null;

const estado = () => {
  if (!ultimo) return { ...APAGADO };
  const haceMs = Date.now() - ultimo.en;
  if (haceMs > TTL_MS) return { ...APAGADO, haceMs };
  return {
    activa: true,
    cuadro: ultimo.cuadro,
    bpm: ultimo.bpm,
    idDispositivo: ultimo.idDispositivo,
    haceMs,
  };
};

const registrar = ({ cuadro, bpm = null, idDispositivo = null }) => {
  ultimo = { cuadro, bpm, idDispositivo, en: Date.now() };
  return estado();
};

const apagar = () => {
  ultimo = null;
  return estado();
};

module.exports = { registrar, apagar, estado, CUADROS, TTL_MS };
