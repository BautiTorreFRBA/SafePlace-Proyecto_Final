/**
 * Simulador de carga en background (corre dentro del propio backend).
 * Lee config_sistema.simulacion_activa cada POLL_MS; cuando está activo
 * genera mediciones para los 10 wearables simulados cada TICK_MS.
 * No necesita ninguna máquina local: cualquier admin lo controla desde la UI.
 */
const medicionesService  = require('./mediciones.service');
const simulacionRepo     = require('../repositories/simulacion.repository');
const db                 = require('../config/database');

const TICK_MS   = 5_000;
const POLL_MS   = 15_000;

// Mismo criterio que simulacion.repository.listarOperariosSimulados: si los dos
// no coinciden, la tabla de la pantalla y lo que realmente emite se desfasan.
const MARCA_SIM = 'SafePlace Sim';

let deviceIds        = [];
let simulacionActiva = false;

// Antes eran 10 MACs fijas resueltas una sola vez: un operario nuevo no podía
// entrar nunca a la simulación, ni asignándole un wearable simulado, porque la
// lista quedaba cacheada hasta reiniciar. Sin asignación vigente la medición se
// descartaría igual, así que emitir para esos sería trabajo perdido.
async function resolverDispositivos() {
  const { rows } = await db.query(
    `SELECT d.id
       FROM dispositivo d
       JOIN asignacion_dispositivo ad ON ad.id_dispositivo = d.id
      WHERE d.marca = $1
        AND d.estado = TRUE
        AND ad.fecha_desde <= now()
        AND (ad.fecha_hasta IS NULL OR ad.fecha_hasta >= now())
      GROUP BY d.id
      ORDER BY d.id;`,
    [MARCA_SIM],
  );
  return rows.map((r) => r.id);
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
    }
    // Se re-resuelve en cada poll, no sólo al activar: así un operario dado de
    // alta y asignado entra a la simulación en el próximo ciclo, sin reiniciar.
    if (simulacionActiva) {
      const previos = deviceIds.length;
      deviceIds = await resolverDispositivos();
      if (deviceIds.length !== previos) {
        console.log(`[sim-bg] ${deviceIds.length} dispositivos simulados con asignación vigente`);
      }
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
