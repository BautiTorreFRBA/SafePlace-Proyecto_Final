#!/usr/bin/env node
/**
 * Simulador de carga SafePlace (sin BLE, multiplataforma — Windows/Linux/Mac).
 *
 * Hace lo mismo que el hub (ble_gateway.py) pero por HTTP directo contra el
 * backend, para N wearables a la vez:
 *   1. GET  /api/v1/dispositivos/lookup?mac=...        (MAC -> id de dispositivo)
 *   2. POST /api/v1/dispositivos/:id/estado-conexion    (CONECTADO / DESCONECTADO)
 *   3. POST /api/v1/mediciones  cada INTERVALO_S segundos por dispositivo
 *
 * Dispositivos simulados: MAC 02:5E:ED:00:00:NN (NN = 01..CANTIDAD en hex),
 * los "SafePlace Sim Carga-NN" cargados en la base.
 *
 * Uso (PowerShell):
 *   $env:GATEWAY_API_KEY = "<clave>"
 *   node tools/load-simulator/simulador-carga.mjs [--cantidad 150] [--intervalo 5]
 *        [--duracion 0] [--url https://safeplace-backend-9vhx.onrender.com]
 *        [--pct-fatiga 8] [--pct-sobreesfuerzo 3] [--pct-inactividad 3] [--dry-run]
 *
 * Perfiles (asignados por dispositivo, repartidos al azar pero fijos por corrida):
 *   normal        FC 68-92 con variación suave
 *   fatiga        FC ~150 sostenida          -> alerta FATIGA
 *   sobreesfuerzo FC ~185 + actividad 1.0    -> alerta SOBREESFUERZO
 *   inactividad   emite 30 s y se desconecta -> INACTIVIDAD_PROLONGADA
 *
 * La clave NUNCA va en el código: sólo por variable de entorno.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);

const BASE = (args.url || process.env.BACKEND_URL || 'https://safeplace-backend-9vhx.onrender.com').replace(/\/$/, '');
const KEY = process.env.GATEWAY_API_KEY;
const CANTIDAD = Number(args.cantidad || 150);
const INTERVALO_MS = Number(args.intervalo || 5) * 1000;
const DURACION_S = Number(args.duracion || 0);
const PCT = {
  fatiga: Number(args['pct-fatiga'] ?? 8),
  sobreesfuerzo: Number(args['pct-sobreesfuerzo'] ?? 3),
  inactividad: Number(args['pct-inactividad'] ?? 3),
};
const DRY = Boolean(args['dry-run']);
const CONCURRENCIA = 20;

if (!KEY && !DRY) {
  console.error('Falta GATEWAY_API_KEY en el entorno (ej: $env:GATEWAY_API_KEY="...").');
  process.exit(1);
}

const headers = { 'x-device-api-key': KEY || '', 'content-type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mac = (n) => '02:5E:ED:00:00:' + n.toString(16).toUpperCase().padStart(2, '0');

async function http(method, path, body, reintentos = 3) {
  for (let i = 0; i < reintentos; i++) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000), // Render free puede tardar en despertar
      });
      const txt = await res.text();
      let json = null;
      try { json = JSON.parse(txt); } catch { /* no JSON */ }
      return { status: res.status, json, txt };
    } catch (e) {
      if (i === reintentos - 1) return { status: 0, json: null, txt: String(e.message || e) };
      await sleep(2000);
    }
  }
}

async function enLotes(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCIA) {
    out.push(...(await Promise.all(items.slice(i, i + CONCURRENCIA).map(fn))));
  }
  return out;
}

// ---- perfiles ---------------------------------------------------------------
function asignarPerfiles(n) {
  const idx = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  const cant = (p) => Math.round((n * p) / 100);
  const perfiles = Array(n).fill('normal');
  let k = 0;
  for (const [perfil, p] of Object.entries(PCT))
    for (let j = 0; j < cant(p); j++) perfiles[idx[k++]] = perfil;
  return perfiles;
}

function fcPara(d) {
  const t = (Date.now() - d.inicio) / 1000;
  const ruido = (Math.random() - 0.5) * 6;
  switch (d.perfil) {
    case 'fatiga': return Math.round(150 + Math.sin(t / 30) * 4 + ruido);
    case 'sobreesfuerzo': return Math.round(185 + Math.sin(t / 20) * 3 + ruido);
    default: return Math.round(80 + Math.sin(t / 45 + d.fase) * 10 + ruido);
  }
}

// ---- main -------------------------------------------------------------------
(async () => {
  const perfiles = asignarPerfiles(CANTIDAD);
  const disp = Array.from({ length: CANTIDAD }, (_, i) => ({
    n: i + 1, mac: mac(i + 1), perfil: perfiles[i], id: null, fase: Math.random() * 6.28,
    inicio: Date.now(), ok: 0, err: 0, conectado: false,
  }));
  const resumen = disp.reduce((a, d) => ((a[d.perfil] = (a[d.perfil] || 0) + 1), a), {});
  console.log(`Backend: ${BASE}\nDispositivos: ${CANTIDAD}  intervalo: ${INTERVALO_MS / 1000}s  perfiles:`, resumen);

  if (DRY) { console.log('--dry-run: no se envía nada.'); return; }

  console.log('Resolviendo MAC -> id (puede tardar si Render está dormido)...');
  await http('GET', '/api/v1/dispositivos/lookup?mac=' + encodeURIComponent(disp[0].mac)); // despertar
  await enLotes(disp, async (d) => {
    const r = await http('GET', '/api/v1/dispositivos/lookup?mac=' + encodeURIComponent(d.mac));
    d.id = r.status === 200 ? r.json?.data?.id ?? null : null;
    if (d.id == null) console.warn(`  ${d.mac}: lookup HTTP ${r.status} ${r.txt.slice(0, 80)}`);
  });
  const activos = disp.filter((d) => d.id != null);
  console.log(`Resueltos: ${activos.length}/${CANTIDAD}`);
  if (!activos.length) process.exit(1);

  const estado = (d, e) => http('POST', `/api/v1/dispositivos/${d.id}/estado-conexion`, { estado: e }).then((r) => {
    if (r.status >= 300) console.warn(`  estado ${e} dev ${d.id}: HTTP ${r.status} ${r.txt.slice(0, 80)}`);
    else d.conectado = e === 'CONECTADO';
  });
  await enLotes(activos, (d) => estado(d, 'CONECTADO'));

  let parar = false;
  const cerrar = async () => {
    if (parar) return;
    parar = true;
    console.log('\nCerrando: marcando dispositivos DESCONECTADO...');
    await enLotes(activos.filter((d) => d.conectado), (d) => estado(d, 'DESCONECTADO'));
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  if (DURACION_S > 0) setTimeout(cerrar, DURACION_S * 1000);

  let tick = 0;
  while (!parar) {
    const t0 = Date.now();
    const emisores = activos.filter((d) => {
      if (d.perfil !== 'inactividad') return true;
      if ((Date.now() - d.inicio) / 1000 < 30) return true;
      if (d.conectado) estado(d, 'DESCONECTADO'); // se corta a los 30 s y no vuelve
      return false;
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
    const ok = activos.reduce((s, d) => s + d.ok, 0), err = activos.reduce((s, d) => s + d.err, 0);
    console.log(`[tick ${tick}] emitiendo ${emisores.length}  ok=${ok} err=${err}  (${Date.now() - t0} ms)`);
    await sleep(Math.max(0, INTERVALO_MS - (Date.now() - t0)));
  }
})();
