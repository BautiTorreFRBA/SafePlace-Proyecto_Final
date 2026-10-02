#!/usr/bin/env node
/**
 * Simulador de carga SafePlace (sin BLE, multiplataforma — Windows/Linux/Mac).
 *
 * Hace lo mismo que el hub (ble_gateway.py) pero por HTTP directo contra el
 * backend, para N wearables simultáneos:
 *   1. GET  /api/v1/dispositivos/lookup?mac=...          (MAC -> id dispositivo)
 *   2. POST /api/v1/dispositivos/:id/estado-conexion      (CONECTADO / DESCONECTADO)
 *   3. POST /api/v1/mediciones  cada INTERVALO_S segundos por dispositivo
 *
 * Dispositivos simulados: MAC 02:5E:ED:00:00:NN (NN = 01..CANTIDAD en hex),
 * los "SafePlace Sim Carga-NN" registrados en la base de datos.
 *
 * Uso (PowerShell):
 *   $env:GATEWAY_API_KEY = "<clave>"
 *   node tools/load-simulator/simulador-carga.mjs [opciones]
 *
 * Opciones:
 *   --cantidad N             Dispositivos a simular             (default: 150)
 *   --intervalo S            Segundos entre mediciones           (default: 5)
 *   --duracion S             Duración total en segundos; 0=∞     (default: 0)
 *   --url URL                URL base del backend                (default: producción)
 *   --pct-fatiga N           % con perfil FATIGA                 (default: 8)
 *   --pct-sobreesfuerzo N    % con perfil SOBREESFUERZO          (default: 3)
 *   --pct-inactividad N      % que emiten 30 s y se desconectan  (default: 3)
 *   --pct-emergencia N       % con perfil EMERGENCIA             (default: 2)
 *   --pct-super-emergencia N % con perfil SUPER_EMERGENCIA       (default: 1)
 *   --dry-run                Valida config sin enviar nada
 *
 * Perfiles:
 *   normal          FC 68–92 suave. Sin alerta.
 *   fatiga          FC ~150 sostenida → FATIGA (Media).
 *   sobreesfuerzo   FC ~185 + actividad 1.0 → SOBREESFUERZO (Crítica).
 *   inactividad     Emite 30 s y desconecta → INACTIVIDAD_PROLONGADA.
 *   emergencia      FC alta 90 s (→ FATIGA + SOBREESFUERZO) → desconecta
 *                   → INACTIVIDAD + escalada a EMERGENCIA automática.
 *   super_emergencia Igual que emergencia pero vuelve a conectar y repite
 *                   3 veces para acumular las EMERGENCIAS que disparan
 *                   SUPER_EMERGENCIA.
 *
 * Comandos interactivos (mientras el simulador corre):
 *   alert fatiga [N]         — inyecta mediciones FC alta en dispositivo N (random si omitís N)
 *   alert sobreesfuerzo [N]  — ídem con actividad 1.0
 *   alert emergencia [N]     — inyecta FC alta + desconecta → cadena hasta EMERGENCIA
 *   alert inactividad [N]    — desconecta el dispositivo N
 *   status                   — resumen rápido
 *   help                     — lista de comandos
 *   quit                     — detener el simulador
 *
 * NOTA sobre EMERGENCIA/SUPER_EMERGENCIA:
 *   El backend las genera automáticamente (no hay endpoint directo).
 *   Para verlas en < 2 min, bajá "Minutos de inactividad" a 1 en
 *   Admin → Configuración → Guardar cambios antes de correr el simulador.
 *   Con 15 min tarda ~17 min desde que el dispositivo se desconecta.
 *
 * La clave NUNCA va en el código: sólo por $env:GATEWAY_API_KEY.
 */

import { createInterface } from 'readline';

// ── Parseo de argumentos ──────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);

const BASE         = (args.url || process.env.BACKEND_URL || 'https://safeplace-backend-9vhx.onrender.com').replace(/\/$/, '');
const KEY          = process.env.GATEWAY_API_KEY;
const CANTIDAD     = Number(args.cantidad     || 150);
const INTERVALO_MS = Number(args.intervalo    || 5) * 1000;
const DURACION_S   = Number(args.duracion     || 0);
const DRY          = Boolean(args['dry-run']);
const CONCURRENCIA = 20;

const PCT = {
  fatiga:            Number(args['pct-fatiga']            ?? 8),
  sobreesfuerzo:     Number(args['pct-sobreesfuerzo']     ?? 3),
  inactividad:       Number(args['pct-inactividad']       ?? 3),
  emergencia:        Number(args['pct-emergencia']        ?? 2),
  super_emergencia:  Number(args['pct-super-emergencia']  ?? 1),
};

// ── Duración de la fase "emitiendo" para perfiles de emergencia ───────────────
const EMISION_EMERGENCIA_MS = 90_000;
const CICLOS_SUPER = 4;
const PAUSA_CICLO_MS = 20_000;

// ── Inyección on-demand ───────────────────────────────────────────────────────
// Mediciones históricas a inyectar para disparar una alerta instantáneamente.
// La ventana cubre minutos_fatiga (0.5 min = 30 s por defecto); con 45 s de
// margen el motor de reglas siempre encuentra suficientes muestras.
const INYECCION_COUNT      = 12;
const INYECCION_VENTANA_MS = 45_000;

if (!KEY && !DRY) {
  console.error('Falta GATEWAY_API_KEY en el entorno.\n  PowerShell: $env:GATEWAY_API_KEY = "<clave>"');
  process.exit(1);
}

// ── Utilidades ────────────────────────────────────────────────────────────────
const headers  = { 'x-device-api-key': KEY || '', 'content-type': 'application/json' };
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));
const mac      = (n)  => '02:5E:ED:00:00:' + n.toString(16).toUpperCase().padStart(2, '0');

async function http(method, path, body, reintentos = 3) {
  for (let i = 0; i < reintentos; i++) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      const txt  = await res.text();
      let   json = null;
      try { json = JSON.parse(txt); } catch { /* no JSON */ }
      return { status: res.status, json, txt };
    } catch (e) {
      if (i === reintentos - 1) return { status: 0, json: null, txt: String(e.message || e) };
      await sleep(2_000);
    }
  }
}

async function enLotes(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCIA)
    out.push(...(await Promise.all(items.slice(i, i + CONCURRENCIA).map(fn))));
  return out;
}

// ── Asignación de perfiles ────────────────────────────────────────────────────
function asignarPerfiles(n) {
  const idx     = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  const cant    = (p) => Math.round((n * p) / 100);
  const perfiles = Array(n).fill('normal');
  let k = 0;
  for (const [perfil, p] of Object.entries(PCT))
    for (let j = 0; j < cant(p); j++) if (k < n) perfiles[idx[k++]] = perfil;
  return perfiles;
}

// ── FC por perfil ─────────────────────────────────────────────────────────────
function fcPara(d) {
  const t     = (Date.now() - d.inicioFase) / 1000;
  const ruido = (Math.random() - 0.5) * 6;
  switch (d.perfilActual || d.perfil) {
    case 'fatiga':
    case 'emergencia':
    case 'super_emergencia': return Math.round(185 + Math.sin(t / 20) * 3 + ruido);
    case 'sobreesfuerzo':    return Math.round(185 + Math.sin(t / 20) * 3 + ruido);
    default:                 return Math.round(80  + Math.sin(t / 45 + d.fase) * 10 + ruido);
  }
}

// ── Registro de estado de conexión ────────────────────────────────────────────
function marcarEstado(d, e, logSilencioso = false) {
  return http('POST', `/api/v1/dispositivos/${d.id}/estado-conexion`, { estado: e }).then((r) => {
    if (r.status >= 300 && !logSilencioso)
      console.warn(`  estado ${e} dev ${d.id}: HTTP ${r.status} ${r.txt.slice(0, 80)}`);
    else d.conectado = e === 'CONECTADO';
  });
}

// ── Inyección histórica para alertas on-demand ────────────────────────────────
// Envía INYECCION_COUNT mediciones con timestamps en el pasado (últimos
// INYECCION_VENTANA_MS ms), todos únicos. El motor de reglas los detecta como
// actividad sostenida y genera la alerta en el próximo ciclo.
async function inyectarHistorico(d, { fc, actividad = undefined }) {
  const ahora    = Date.now();
  const interval = INYECCION_VENTANA_MS / INYECCION_COUNT;
  let ok = 0; let skip = 0; let err = 0;
  for (let i = 0; i < INYECCION_COUNT; i++) {
    const ts      = new Date(ahora - INYECCION_VENTANA_MS + i * interval).toISOString();
    const payload = { idDispositivo: d.id, timestamp: ts, frecuenciaCardiaca: fc };
    if (actividad != null) payload.nivelActividad = actividad;
    const r = await http('POST', '/api/v1/mediciones', payload, 1);
    if (r.status === 201 || r.status === 200) ok++;
    else if (r.status === 409) skip++;
    else { err++; if (err <= 2) console.warn(`  [inyec] dev ${d.id}: HTTP ${r.status} ${r.txt.slice(0, 80)}`); }
  }
  return { ok, skip, err };
}

// ── Disparar alerta on-demand ─────────────────────────────────────────────────
async function dispararAlerta(tipo, nDispositivo, activos) {
  let d;
  if (nDispositivo != null) {
    d = activos.find((x) => x.n === nDispositivo);
    if (!d) { console.log(`  [alert] No existe dispositivo ${nDispositivo} en esta corrida (rango: 1–${activos.length}).`); return; }
    if (!d.id) { console.log(`  [alert] Dispositivo ${nDispositivo} no tiene id (lookup fallido al inicio).`); return; }
  } else {
    const elegibles = activos.filter((x) => x.id != null);
    if (!elegibles.length) { console.log('  [alert] Sin dispositivos disponibles.'); return; }
    d = elegibles[Math.floor(Math.random() * elegibles.length)];
  }

  console.log(`\n[on-demand] ${tipo.toUpperCase()} → dispositivo ${d.n} (id=${d.id}, perfil=${d.perfil})`);

  switch (tipo.toLowerCase()) {
    case 'fatiga': {
      const r = await inyectarHistorico(d, { fc: 185 });
      console.log(`  Inyectadas ${r.ok} mediciones FC=185 (${r.skip} ya existían).`);
      console.log(`  El backend creará FATIGA en el próximo ciclo del motor de reglas.`);
      break;
    }
    case 'sobreesfuerzo': {
      const r = await inyectarHistorico(d, { fc: 185, actividad: 1.0 });
      console.log(`  Inyectadas ${r.ok} mediciones FC=185 + act=1.0 (${r.skip} ya existían).`);
      console.log(`  El backend creará SOBREESFUERZO (y FATIGA si aún no existe).`);
      break;
    }
    case 'emergencia': {
      // Sobreesfuerzo + desconexión → cadena INACTIVIDAD → EMERGENCIA automática
      const r = await inyectarHistorico(d, { fc: 185, actividad: 1.0 });
      await marcarEstado(d, 'DESCONECTADO');
      console.log(`  Inyectadas ${r.ok} mediciones + dispositivo ${d.n} marcado DESCONECTADO.`);
      console.log(`  Cadena: FATIGA + SOBREESFUERZO → INACTIVIDAD_PROLONGADA → EMERGENCIA.`);
      console.log(`  Tiempo estimado: ~minutos_inactividad + 10 s.`);
      console.log(`  Con umbral = 1 min (Admin → Configuración): visible en ~70 s.`);
      break;
    }
    case 'inactividad': {
      await marcarEstado(d, 'DESCONECTADO');
      console.log(`  Dispositivo ${d.n} marcado DESCONECTADO.`);
      console.log(`  INACTIVIDAD_PROLONGADA aparecerá al vencer minutos_inactividad.`);
      break;
    }
    default:
      console.log(`  Tipo desconocido: "${tipo}". Válidos: fatiga | sobreesfuerzo | emergencia | inactividad`);
  }
  console.log('');
}

// ── Ciclo de emergencia (para perfiles emergencia / super_emergencia) ─────────
async function cicloEmergencia(d, parar) {
  const repeticiones = d.perfil === 'super_emergencia' ? CICLOS_SUPER : 1;

  for (let c = 0; c < repeticiones && !parar(); c++) {
    d.perfilActual = 'emergencia';
    d.inicioFase   = Date.now();
    await marcarEstado(d, 'CONECTADO');

    const fin = Date.now() + EMISION_EMERGENCIA_MS;
    while (Date.now() < fin && !parar()) {
      const payload = {
        idDispositivo: d.id,
        timestamp: new Date().toISOString(),
        frecuenciaCardiaca: fcPara(d),
        nivelActividad: 1.0,
      };
      const r = await http('POST', '/api/v1/mediciones', payload, 1);
      if (r.status === 201 || r.status === 200) d.ok++;
      else d.err++;
      await sleep(Math.min(INTERVALO_MS, fin - Date.now()));
    }

    await marcarEstado(d, 'DESCONECTADO');
    d.perfilActual = 'desconectado';
    d.conectado    = false;
    console.log(`  [emerg cycle ${c + 1}/${repeticiones}] dev ${d.id} desconectado → esperando INACTIVIDAD del backend`);

    if (c < repeticiones - 1 && !parar()) {
      console.log(`  [emerg cycle ${c + 1}/${repeticiones}] dev ${d.id} pausa ${PAUSA_CICLO_MS / 1000} s antes del ciclo siguiente`);
      await sleep(PAUSA_CICLO_MS);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const perfiles = asignarPerfiles(CANTIDAD);
  const disp = Array.from({ length: CANTIDAD }, (_, i) => ({
    n: i + 1,
    mac: mac(i + 1),
    perfil: perfiles[i],
    perfilActual: null,
    id: null,
    fase: Math.random() * 6.28,
    inicio: Date.now(),
    inicioFase: Date.now(),
    ok: 0, err: 0,
    conectado: false,
    cicloTerminado: false,
  }));

  const resumen = disp.reduce((a, d) => ((a[d.perfil] = (a[d.perfil] || 0) + 1), a), {});
  console.log(`\nBackend   : ${BASE}`);
  console.log(`Dispositivos: ${CANTIDAD}  |  Intervalo: ${INTERVALO_MS / 1000} s`);
  console.log('Perfiles  :', resumen);
  console.log('');

  if (DRY) {
    console.log('--dry-run: configuración validada, no se envía nada.');
    return;
  }

  // ── Resolución de MACs ──────────────────────────────────────────────────────
  console.log('Resolviendo MAC → id de dispositivo (puede tardar si Render está dormido)...');
  await http('GET', '/api/v1/dispositivos/lookup?mac=' + encodeURIComponent(disp[0].mac));
  await enLotes(disp, async (d) => {
    const r = await http('GET', '/api/v1/dispositivos/lookup?mac=' + encodeURIComponent(d.mac));
    d.id = r.status === 200 ? r.json?.data?.id ?? null : null;
    if (d.id == null) console.warn(`  ${d.mac}: lookup HTTP ${r.status} — ¿no está registrado en la base?`);
  });
  const activos = disp.filter((d) => d.id != null);
  console.log(`Resueltos: ${activos.length}/${CANTIDAD}\n`);
  if (!activos.length) { console.error('Sin dispositivos. Abortando.'); process.exit(1); }

  // ── Conexión inicial ────────────────────────────────────────────────────────
  const normales = activos.filter((d) => !['emergencia', 'super_emergencia'].includes(d.perfil));
  await enLotes(normales, (d) => marcarEstado(d, 'CONECTADO'));

  // ── Cierre limpio ───────────────────────────────────────────────────────────
  let parar = false;
  const cerrar = async () => {
    if (parar) return;
    parar = true;
    console.log('\nDeteniendo: marcando dispositivos DESCONECTADO...');
    await enLotes(activos.filter((d) => d.conectado), (d) => marcarEstado(d, 'DESCONECTADO'));
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  if (DURACION_S > 0) setTimeout(cerrar, DURACION_S * 1000);

  // ── Lanzar ciclos de emergencia en paralelo ─────────────────────────────────
  const emergentes = activos.filter((d) => ['emergencia', 'super_emergencia'].includes(d.perfil));
  for (const d of emergentes) {
    cicloEmergencia(d, () => parar).then(() => { d.cicloTerminado = true; });
  }

  // ── Modo interactivo ────────────────────────────────────────────────────────
  const rl = createInterface({ input: process.stdin, terminal: false });
  console.log('Comandos disponibles mientras el simulador corre:');
  console.log('  alert <tipo> [N]   — fatiga | sobreesfuerzo | emergencia | inactividad  (N = número de dispositivo, random si omitís)');
  console.log('  status             — resumen rápido');
  console.log('  help               — lista de comandos');
  console.log('  quit               — detener\n');

  rl.on('line', async (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd   = parts[0]?.toLowerCase();
    if (!cmd) return;

    if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') {
      rl.close();
      await cerrar();
      return;
    }

    if (cmd === 'status') {
      const ok  = activos.reduce((s, d) => s + d.ok,  0);
      const err = activos.reduce((s, d) => s + d.err, 0);
      const con = activos.filter((d) => d.conectado).length;
      console.log(`\n[status] Conectados: ${con}/${activos.length}  ok=${ok} err=${err}\n`);
      return;
    }

    if (cmd === 'help' || cmd === '?') {
      console.log('\nComandos:');
      console.log('  alert fatiga [N]         — inyecta mediciones FC alta → FATIGA');
      console.log('  alert sobreesfuerzo [N]  — inyecta FC alta + actividad → SOBREESFUERZO');
      console.log('  alert emergencia [N]     — FC alta + desconecta → cadena hasta EMERGENCIA');
      console.log('  alert inactividad [N]    — desconecta el dispositivo → INACTIVIDAD');
      console.log('  status                   — estado actual');
      console.log('  quit                     — detener el simulador\n');
      return;
    }

    if (cmd === 'alert' || cmd === 'alerta') {
      const tipo = parts[1];
      const n    = parts[2] ? Number(parts[2]) : null;
      if (!tipo) {
        console.log('  Uso: alert <tipo> [N]  — tipos: fatiga | sobreesfuerzo | emergencia | inactividad');
        return;
      }
      await dispararAlerta(tipo, n, activos);
      return;
    }

    console.log(`  Comando desconocido: "${cmd}". Escribí "help" para ver los disponibles.`);
  });

  rl.on('close', () => { if (!parar) cerrar(); });

  // ── Loop principal ──────────────────────────────────────────────────────────
  let tick = 0;
  while (!parar) {
    const t0 = Date.now();

    const emisores = activos.filter((d) => {
      if (['emergencia', 'super_emergencia'].includes(d.perfil)) return false;
      if (d.perfil === 'inactividad') {
        if ((Date.now() - d.inicio) / 1000 < 30) return true;
        if (d.conectado) marcarEstado(d, 'DESCONECTADO', true);
        return false;
      }
      return true;
    });

    await enLotes(emisores, async (d) => {
      const payload = {
        idDispositivo: d.id,
        timestamp: new Date().toISOString(),
        frecuenciaCardiaca: fcPara(d),
      };
      if (d.perfil === 'sobreesfuerzo') payload.nivelActividad = 1.0;
      const r = await http('POST', '/api/v1/mediciones', payload, 1);
      if (r.status === 201 || r.status === 200) d.ok++;
      else { d.err++; if (d.err <= 2) console.warn(`  dev ${d.id} (${d.perfil}): HTTP ${r.status} ${r.txt.slice(0, 100)}`); }
    });

    tick++;
    const ok  = activos.reduce((s, d) => s + d.ok,  0);
    const err = activos.reduce((s, d) => s + d.err, 0);
    const emerg_activas = emergentes.filter((d) => d.conectado).length;
    const emerg_espera  = emergentes.filter((d) => !d.conectado && !d.cicloTerminado).length;
    const extra = emergentes.length
      ? `  emergencia: ${emerg_activas} emitiendo / ${emerg_espera} esperando inactividad`
      : '';
    console.log(`[tick ${String(tick).padStart(3)}] emitiendo ${emisores.length}  ok=${ok} err=${err}  (${Date.now() - t0} ms)${extra}`);

    await sleep(Math.max(0, INTERVALO_MS - (Date.now() - t0)));
  }
})();
