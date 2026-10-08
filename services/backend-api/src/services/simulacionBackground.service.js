/**
 * Simulador de carga en background (corre dentro del propio backend).
 * Lee config_sistema.simulacion_activa cada POLL_MS; cuando está activo
 * genera mediciones para los 10 wearables simulados cada TICK_MS.
 * No necesita ninguna máquina local: cualquier admin lo controla desde la UI.
 */
const medicionesService  = require('./mediciones.service');
const simulacionRepo     = require('../repositories/simulacion.repository');
const db                 = require('../config/database');

const CANTIDAD  = 10;
const TICK_MS   = 5_000;
const POLL_MS   = 15_000;

const simMac = (n) => `02:5E:ED:00:00:${n.toString(16).toUpperCase().padStart(2, '0')}`;

let deviceIds       = null;   // [id, id, …] resueltos al primer arranque
let simulacionActiva = false;

async function resolverDispositivos() {
  const ids = [];
  for (let i = 1; i <= CANTIDAD; i++) {
    const { rows } = await db.query(
      'SELECT id FROM dispositivo WHERE mac_address = $1 LIMIT 1',
      [simMac(i)],
    );
    if (rows[0]) ids.push(rows[0].id);
  }
  console.log(`[sim-bg] ${ids.length}/${CANTIDAD} dispositivos sim resueltos`);
  return ids;
}

function fcAleatoria(seed) {
  return Math.round(80 + Math.sin(Date.now() / 45_000 + seed) * 10 + (Math.random() - 0.5) * 6);
}

async function emitirTick() {
  if (!simulacionActiva || !deviceIds?.length) return;
  const timestamp = new Date().toISOString();
  for (const id of deviceIds) {
    try {
      await medicionesService.registrarMedicion({ idDispositivo: id, frecuenciaCardiaca: fcAleatoria(id), timestamp });
    } catch (e) {
      // 409 = duplicado por timestamp repetido (raro); otros errores: loguear
      if (e.status !== 409 && !String(e.message).includes('uplica')) {
        console.error(`[sim-bg] dev ${id}:`, e.message);
      }
    }
  }
}

async function pollEstado() {
  try {
    const estado = await simulacionRepo.obtenerEstado();
    const nueva  = estado.simulacion_activa;
    if (nueva !== simulacionActiva) {
      simulacionActiva = nueva;
      console.log(nueva ? '[sim-bg] ▶ Simulación ACTIVADA' : '[sim-bg] ⏸ Simulación PAUSADA');
      if (nueva && !deviceIds) deviceIds = await resolverDispositivos();
    }
  } catch (e) {
    console.error('[sim-bg] poll error:', e.message);
  }
}

function iniciar() {
  pollEstado();
  setInterval(pollEstado,  POLL_MS);
  setInterval(emitirTick,  TICK_MS);
  console.log('[sim-bg] Servicio de simulación en background iniciado');
}

module.exports = { iniciar };
