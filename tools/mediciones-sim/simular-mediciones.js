#!/usr/bin/env node
'use strict';

/**
 * Simulador de mediciones SIN BLE: hace lo mismo que el hub (ble_gateway.py)
 * hacia el backend, para N dispositivos a la vez.
 *   POST /api/v1/mediciones                        una lectura cada `intervalo` s
 *   POST /api/v1/dispositivos/:id/estado-conexion  CONECTADO / DESCONECTADO
 *
 * Reutiliza los escenarios de tools/ble-simulator/shared/scenarios/*.json
 * (normal, fatigue, overexertion, inactivity, connection-loss, invalid).
 *
 * Node >= 18, sin dependencias. Ver README.md.
 */

const fs = require('fs');
const path = require('path');

const SCENARIOS_DIR = path.resolve(__dirname, '../ble-simulator/shared/scenarios');
const DEFAULT_URL = 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const REQUEST_TIMEOUT_MS = 30000; // Render free tier tarda en despertar

const AYUDA = `
Uso: node simular-mediciones.js --devices <id[:escenario],...> [opciones]

  --devices       ids de dispositivo del backend, cada uno con escenario opcional.
                  Ej: 8,11,12:fatigue,13:overexertion   (default escenario: normal)
  --escenario     escenario para los que no lo traen en --devices (default normal)
  --key           GATEWAY_API_KEY (o variable de entorno GATEWAY_API_KEY)
  --url           base de la API (default ${DEFAULT_URL}, o SAFEPLACE_API_URL)
  --intervalo     segundos entre lecturas (default: el del escenario, 5)
  --duracion      segundos totales (default: el del escenario; 0 = hasta Ctrl-C)
  --roster        archivo JSON con la flota (ver roster.json). Reemplaza a --devices:
                  resuelve cada MAC a su id de dispositivo y corre hasta apagarse.
  --cantidad      con --roster: usa solo los primeros N de la flota
  --stop-file     con --roster: apaga ordenadamente (todos DESCONECTADO) cuando
                  aparece este archivo; lo usa carga.js
  --sin-estado    no reportar CONECTADO/DESCONECTADO (solo mediciones)
  --dry-run       imprime lo que enviaría, sin tocar la red
  --help
`;

function parseArgs(argv) {
  const out = { flags: new Set(), valores: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (['sin-estado', 'dry-run', 'help'].includes(k)) out.flags.add(k);
    else out.valores[k] = argv[++i];
  }
  return out;
}

function cargarEscenario(nombre) {
  const archivo = path.join(SCENARIOS_DIR, `${nombre}.json`);
  if (!fs.existsSync(archivo)) {
    const disponibles = fs.readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    throw new Error(`Escenario "${nombre}" no existe. Disponibles: ${disponibles.join(', ')}`);
  }
  const s = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  s.heartRate = { jitter: 0, min: 30, max: 220, ...s.heartRate };
  s.actions = s.actions || [];
  return s;
}

const aleatorio = (n) => (n === 0 ? 0 : Math.floor(Math.random() * (2 * n + 1)) - n);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function siguienteBpm(hr) {
  return clamp(hr.base + aleatorio(hr.jitter), hr.min, hr.max);
}

// Aproximación del proxy de actividad del hub (activity.py, modo hr-proxy):
// FC ~75 => ~0.1-0.2, FC ~150 => ~0.75, FC >= 180 => ~1.0.
function nivelActividad(bpm) {
  return Number(clamp((bpm - 60) / 120 + (Math.random() - 0.5) * 0.06, 0, 1).toFixed(3));
}

function crearCliente({ url, key, dryRun }) {
  const stats = { enviados: 0, porStatus: {}, errores: 0 };
  const erroresVistos = new Set();

  async function post(ruta, body, etiqueta) {
    if (dryRun) {
      console.log(`[dry-run] POST ${ruta} ${JSON.stringify(body)}`);
      return { status: 0 };
    }
    try {
      const res = await fetch(`${url}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const json = await res.json().catch(() => ({}));
      stats.enviados += 1;
      stats.porStatus[res.status] = (stats.porStatus[res.status] || 0) + 1;
      if (res.status >= 300) {
        // Un mismo rechazo se muestra una sola vez por dispositivo: con 20
        // dispositivos rechazados el log se haría ilegible.
        const huella = `${etiqueta}|${res.status}|${json.motivo || ''}`;
        if (!erroresVistos.has(huella)) {
          erroresVistos.add(huella);
          console.warn(`[${etiqueta}] HTTP ${res.status} ${json.motivo || ''} ${json.error || ''}`.trim());
        }
      }
      return { status: res.status, body: json };
    } catch (e) {
      stats.errores += 1;
      const huella = `${etiqueta}|red|${e.name}`;
      if (!erroresVistos.has(huella)) {
        erroresVistos.add(huella);
        console.warn(`[${etiqueta}] sin respuesta del backend: ${e.message}`);
      }
      return { status: -1 };
    }
  }

  async function get(ruta) {
    if (dryRun) return { status: 200, body: { data: { id: null } } };
    try {
      const res = await fetch(`${url}${ruta}`, {
        headers: { 'x-device-api-key': key },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    } catch (e) {
      return { status: -1, body: { error: e.message } };
    }
  }

  return { post, get, stats, dryRun };
}

// Escenario sintético de un operario de la flota: trabajo normal, FC
// alrededor de `perfil.base`, sin acciones programadas, sin fin.
function escenarioDeRoster(entrada) {
  const p = entrada.perfil || {};
  return {
    name: entrada.legajo || entrada.mac,
    intervalSeconds: 5,
    durationSeconds: 0,
    loop: true,
    actions: [],
    heartRate: {
      base: p.base ?? 88,
      jitter: p.jitter ?? 8,
      min: p.min ?? 65,
      max: p.max ?? 115,
    },
  };
}

// Resuelve el id del backend de cada MAC del roster (mismo endpoint que usa el hub).
async function resolverRoster(archivo, cantidad, cliente) {
  const ruta = path.resolve(archivo);
  const roster = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const entradas = (roster.dispositivos || []).slice(0, cantidad || undefined);
  if (!entradas.length) throw new Error(`El roster ${ruta} no tiene dispositivos.`);

  const resueltos = [];
  const faltantes = [];
  let n = 0;
  for (const e of entradas) {
    n += 1;
    const r = await cliente.get(`/dispositivos/lookup?mac=${encodeURIComponent(e.mac)}`);
    const id = r.body?.data?.id ?? (r.status === 200 && cliente.dryRun ? 9000 + n : null);
    if (r.status === 200 && id) resueltos.push({ ...e, id });
    else faltantes.push(`${e.legajo || ''} ${e.mac} (HTTP ${r.status})`.trim());
  }
  if (faltantes.length === entradas.length) {
    throw new Error(`Ninguna MAC del roster existe en el backend (${faltantes[0]}…). ¿Corriste sql/sembrar-carga.sql? ¿La API key es correcta?`);
  }
  if (faltantes.length) {
    console.warn(`AVISO: ${faltantes.length} dispositivo(s) del roster no existen y se omiten: ${faltantes.join('; ')}`);
  }
  return resueltos;
}

class DispositivoSim {
  constructor({ id, escenario, intervalo, duracion, conEstado, cliente, silencioso = false, etiqueta = null }) {
    this.id = id;
    this.silencioso = silencioso;
    this.escenario = escenario;
    this.intervalo = intervalo;
    this.duracion = duracion;
    this.conEstado = conEstado;
    this.cliente = cliente;
    this.transcurrido = 0;
    this.emitiendo = true;
    this.conectado = false;
    this.accionesHechas = new Set();
    this.timer = null;
    this.terminado = false;
    this.etiqueta = etiqueta || `disp ${id}/${escenario.name}`;
  }

  async reportarEstado(estado) {
    if (!this.conEstado) return;
    await this.cliente.post(`/dispositivos/${this.id}/estado-conexion`, { estado }, this.etiqueta);
    this.conectado = estado === 'CONECTADO';
  }

  async iniciar() {
    await this.reportarEstado('CONECTADO');
    // Escalonado: sin esto los N dispositivos pegarían todos en el mismo instante.
    const espera = Math.random() * this.intervalo * 1000;
    this.timer = setTimeout(() => this.tick(), espera);
  }

  async tick() {
    if (this.terminado) return;

    for (const [idx, a] of this.escenario.actions.entries()) {
      if (this.accionesHechas.has(idx) || this.transcurrido < a.atSeconds) continue;
      this.accionesHechas.add(idx);
      if (a.do === 'disconnect') {
        console.log(`[${this.etiqueta}] @${a.atSeconds}s desconexión`);
        this.emitiendo = false;
        await this.reportarEstado('DESCONECTADO');
      } else if (a.do === 'reconnect') {
        console.log(`[${this.etiqueta}] @${a.atSeconds}s reconexión`);
        this.emitiendo = true;
        await this.reportarEstado('CONECTADO');
      }
    }

    if (this.emitiendo) {
      const bpm = siguienteBpm(this.escenario.heartRate);
      const r = await this.cliente.post('/mediciones', {
        idDispositivo: this.id,
        timestamp: new Date().toISOString(),
        frecuenciaCardiaca: bpm,
        nivelActividad: nivelActividad(bpm),
      }, this.etiqueta);
      if (r.status === 201 && !this.silencioso) console.log(`[${this.etiqueta}] ${bpm} BPM ok`);
    }

    this.transcurrido += this.intervalo;
    const limite = this.duracion === null ? this.escenario.durationSeconds : this.duracion;
    const cortaPorTiempo = limite > 0 && this.transcurrido >= limite && (this.duracion !== null || !this.escenario.loop);
    if (cortaPorTiempo) {
      console.log(`[${this.etiqueta}] escenario terminado`);
      await this.detener();
      return;
    }
    this.timer = setTimeout(() => this.tick(), this.intervalo * 1000);
  }

  async detener() {
    if (this.terminado) return;
    this.terminado = true;
    clearTimeout(this.timer);
    // Como el hub: al irse el wearable se reporta DESCONECTADO (si estaba conectado).
    if (this.conectado) await this.reportarEstado('DESCONECTADO');
  }
}

async function main() {
  const { flags, valores } = parseArgs(process.argv.slice(2));
  if (flags.has('help') || (!valores.devices && !valores.roster)) {
    console.log(AYUDA);
    process.exit(flags.has('help') ? 0 : 1);
  }

  const dryRun = flags.has('dry-run');
  const key = valores.key || process.env.GATEWAY_API_KEY;
  if (!key && !dryRun) {
    console.error('Falta la API key del gateway: --key o variable GATEWAY_API_KEY (no se guarda en el repo).');
    process.exit(1);
  }
  const url = (valores.url || process.env.SAFEPLACE_API_URL || DEFAULT_URL).replace(/\/$/, '');
  const escenarioDefault = valores.escenario || 'normal';
  const conEstado = !flags.has('sin-estado');
  const duracion = valores.duracion === undefined ? null : Number(valores.duracion);
  const intervaloForzado = valores.intervalo === undefined ? null : Number(valores.intervalo);

  const cliente = crearCliente({ url, key, dryRun });
  const modoRoster = Boolean(valores.roster);
  const stopFile = valores['stop-file'] ? path.resolve(valores['stop-file']) : null;

  let dispositivos;
  if (modoRoster) {
    const flota = await resolverRoster(valores.roster, Number(valores.cantidad) || 0, cliente);
    dispositivos = flota.map((e) => {
      const escenario = escenarioDeRoster(e);
      return new DispositivoSim({
        id: e.id,
        escenario,
        intervalo: intervaloForzado || escenario.intervalSeconds,
        duracion: duracion === null ? 0 : duracion, // 0 = hasta apagarse
        conEstado,
        cliente,
        silencioso: true,
        etiqueta: `${e.legajo || 'disp'} #${e.id}`,
      });
    });
  } else {
    dispositivos = valores.devices.split(',').map((tok) => {
      const [idTxt, nombre] = tok.trim().split(':');
      const id = Number(idTxt);
      if (!Number.isInteger(id) || id <= 0) throw new Error(`id de dispositivo inválido: "${tok}"`);
      const escenario = cargarEscenario(nombre || escenarioDefault);
      return new DispositivoSim({
        id,
        escenario,
        intervalo: intervaloForzado || escenario.intervalSeconds || 5,
        duracion,
        conEstado,
        cliente,
      });
    });
  }

  console.log(`Simulando ${dispositivos.length} dispositivo(s) contra ${dryRun ? '(dry-run)' : url}`);
  console.log('ATENCIÓN: escribe en la base real del backend. Usá solo operarios de prueba.\n');

  let cerrando = false;
  const cerrar = async () => {
    if (cerrando) return;
    cerrando = true;
    console.log('\nDeteniendo…');
    await Promise.all(dispositivos.map((d) => d.detener()));
    imprimirResumen(cliente.stats, dispositivos);
    console.log('[apagado] todos los dispositivos reportados DESCONECTADO.');
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);

  // Apagado por archivo (carga.js off): portable, anda igual en Windows donde
  // las señales entre procesos no dejan cerrar ordenadamente.
  if (stopFile) {
    setInterval(() => { if (fs.existsSync(stopFile)) cerrar(); }, 1000);
  }

  const resumen = setInterval(() => imprimirResumen(cliente.stats, dispositivos), 15000);
  await Promise.all(dispositivos.map((d) => d.iniciar()));
  if (modoRoster) console.log(`[encendido] ${dispositivos.filter((d) => d.conectado).length}/${dispositivos.length} dispositivos CONECTADO.`);

  // Corre hasta que todos terminen solos (escenarios no-loop) o Ctrl-C.
  await new Promise((resolve) => {
    const espera = setInterval(() => {
      if (dispositivos.every((d) => d.terminado)) {
        clearInterval(espera);
        resolve();
      }
    }, 1000);
  });
  clearInterval(resumen);
  imprimirResumen(cliente.stats);
}

function imprimirResumen({ enviados, porStatus, errores }, dispositivos = null) {
  const detalle = Object.entries(porStatus).map(([s, n]) => `${s}:${n}`).join(' ') || '-';
  const conectados = dispositivos ? ` conectados=${dispositivos.filter((d) => d.conectado).length}/${dispositivos.length}` : '';
  console.log(`[resumen] ${new Date().toISOString()}${conectados} requests=${enviados} por status={ ${detalle} } sin respuesta=${errores}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
