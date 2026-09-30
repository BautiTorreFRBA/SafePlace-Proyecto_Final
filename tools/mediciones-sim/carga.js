#!/usr/bin/env node
'use strict';

/**
 * Encender / apagar la simulación de carga (los 20 operarios a la vez).
 *
 *   node carga.js on       conecta a todos y empieza a mandar mediciones (en segundo plano)
 *   node carga.js off      todos DESCONECTADO y frena
 *   node carga.js status   ¿está encendida? conectados, requests, problemas
 *   node carga.js status --watch   lo mismo pero refrescando cada 3 s
 *
 * Extras: `on --cantidad 5` (solo los primeros 5), `on --dry-run` (sin red),
 * `on --url <api>`. Lee GATEWAY_API_KEY / SAFEPLACE_API_URL del entorno o del
 * .env de la raíz del repo (archivo ignorado por git). Ver README.md.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = __dirname;
const PID_FILE = path.join(DIR, 'carga.pid');
const LOG_FILE = path.join(DIR, 'carga.log');
const STOP_FILE = path.join(DIR, 'carga.stop');
const ROSTER = path.join(DIR, 'roster.json');
const MOTOR = path.join(DIR, 'simular-mediciones.js');
const ESPERA_APAGADO_MS = 30000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function vivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function pidActivo() {
  if (!fs.existsSync(PID_FILE)) return null;
  const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
  if (pid && vivo(pid)) return pid;
  fs.rmSync(PID_FILE, { force: true }); // PID viejo de una corrida que murió
  return null;
}

// Parser mínimo de .env (KEY=valor, # comentarios, comillas opcionales).
function leerEnv(archivo) {
  const out = {};
  if (!fs.existsSync(archivo)) return out;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || linea.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function entorno() {
  const raiz = path.resolve(DIR, '../..');
  const env = { ...leerEnv(path.join(raiz, '.env')), ...leerEnv(path.join(DIR, '.env')) };
  return {
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY || env.GATEWAY_API_KEY,
    SAFEPLACE_API_URL: process.env.SAFEPLACE_API_URL || env.SAFEPLACE_API_URL,
  };
}

function ultimasLineas(n, filtro) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lineas = fs.readFileSync(LOG_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  return (filtro ? lineas.filter((l) => l.includes(filtro)) : lineas).slice(-n);
}

async function encender(extra) {
  const pid = pidActivo();
  if (pid) {
    console.log(`Ya está encendida (PID ${pid}). Usá "off" primero si querés reiniciarla.`);
    return;
  }
  const dryRun = extra.includes('--dry-run');
  const env = entorno();
  if (!env.GATEWAY_API_KEY && !dryRun) {
    console.error('Falta GATEWAY_API_KEY. Definila como variable de entorno o en el .env de la raíz del repo\n'
      + '(la misma clave que usa el hub). No se guarda en el repo.');
    process.exit(1);
  }

  fs.rmSync(STOP_FILE, { force: true });
  const log = fs.openSync(LOG_FILE, 'w');
  const hijo = spawn(process.execPath, [MOTOR, '--roster', ROSTER, '--stop-file', STOP_FILE, ...extra], {
    cwd: DIR,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
    env: { ...process.env, ...Object.fromEntries(Object.entries(env).filter(([, v]) => v)) },
  });
  hijo.unref();
  fs.writeFileSync(PID_FILE, String(hijo.pid));

  // Esperar a ver "[encendido]" (o que el proceso muera) para informar de verdad.
  console.log('Encendiendo (el backend de Render puede tardar ~30 s en despertar)…');
  const limite = Date.now() + 60000;
  while (Date.now() < limite) {
    await dormir(1000);
    if (!vivo(hijo.pid)) {
      fs.rmSync(PID_FILE, { force: true });
      console.error('El simulador se cerró al arrancar. Log:\n' + ultimasLineas(10).join('\n'));
      process.exit(1);
    }
    const listo = ultimasLineas(50, '[encendido]').pop();
    if (listo) {
      console.log(`ENCENDIDA (PID ${hijo.pid}). ${listo}`);
      const avisos = ultimasLineas(50).filter((l) => /AVISO|HTTP|sin respuesta/.test(l));
      if (avisos.length) console.log('Avisos:\n  ' + avisos.join('\n  '));
      console.log('Apagar: npm run off   |   Estado: npm run status   |   Log: tools/mediciones-sim/carga.log');
      return;
    }
  }
  console.log(`Arrancó (PID ${hijo.pid}) pero aún no confirmó el encendido. Mirá: npm run status`);
}

async function apagar() {
  const pid = pidActivo();
  if (!pid) {
    console.log('No está encendida.');
    fs.rmSync(STOP_FILE, { force: true });
    return;
  }
  fs.writeFileSync(STOP_FILE, new Date().toISOString());
  console.log(`Apagando PID ${pid}: reportando DESCONECTADO de todos los operarios…`);
  const limite = Date.now() + ESPERA_APAGADO_MS;
  while (Date.now() < limite && vivo(pid)) await dormir(500);

  if (vivo(pid)) {
    console.error('No terminó a tiempo; se fuerza el cierre (algunos DESCONECTADO pueden no haberse enviado).');
    try { process.kill(pid); } catch { /* ya no existe */ }
  } else {
    const fin = ultimasLineas(5, '[apagado]').pop();
    console.log(`APAGADA. ${fin || ''}`.trim());
  }
  fs.rmSync(PID_FILE, { force: true });
  fs.rmSync(STOP_FILE, { force: true });
}

// Parsea la línea "[resumen] <iso> conectados=X/Y requests=N por status={ ... } sin respuesta=M"
// que imprime simular-mediciones.js cada 15 s.
function parseResumen(linea) {
  if (!linea) return null;
  const m = linea.match(/^\[resumen\] (\S+) conectados=(\d+)\/(\d+) requests=(\d+) por status=\{ (.*) \} sin respuesta=(\d+)/);
  if (!m) return null;
  return {
    ts: m[1], conectados: Number(m[2]), total: Number(m[3]),
    requests: Number(m[4]), statusDetalle: m[5], sinRespuesta: Number(m[6]),
  };
}

function fmtDuracion(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
}

// Devuelve false si ya no hay nada encendido (para que --watch corte solo).
function imprimirEstado() {
  const pid = pidActivo();
  if (!pid) {
    console.log('APAGADA.');
    return false;
  }

  let desde = null;
  try { desde = fs.statSync(PID_FILE).birthtime; } catch { /* sin info de inicio */ }
  console.log(`ENCENDIDA (PID ${pid})${desde ? ` — activa hace ${fmtDuracion(Date.now() - desde.getTime())}` : ''}`);

  const ultimo = parseResumen(ultimasLineas(50, '[resumen]').pop());
  if (ultimo) {
    const antiguedad = Math.round((Date.now() - new Date(ultimo.ts).getTime()) / 1000);
    console.log(`Conectados: ${ultimo.conectados}/${ultimo.total}`);
    console.log(`Requests: ${ultimo.requests} enviados, ${ultimo.sinRespuesta} sin respuesta del backend   |   por status: { ${ultimo.statusDetalle || '-'} }`);
    console.log(`Último resumen: hace ${antiguedad}s (se actualiza cada 15s)`);
  } else {
    console.log('Todavía sin resumen (recién está arrancando; el backend de Render puede tardar ~30s en despertar).');
  }

  const problemas = ultimasLineas(300).filter((l) => /^\[.*\] HTTP|AVISO|sin respuesta del backend/.test(l));
  if (problemas.length) {
    console.log(`Problemas detectados (${problemas.length}):\n  ${[...new Set(problemas)].slice(-8).join('\n  ')}`);
  } else {
    console.log('Sin problemas detectados.');
  }
  return true;
}

function estado(extra) {
  if (!extra.includes('--watch') && !extra.includes('-w')) {
    imprimirEstado();
    return;
  }
  console.log('Actualizando cada 3s — Ctrl+C para salir.\n');
  const intervalo = setInterval(() => {
    console.clear();
    console.log(`SafePlace — simulación de carga   ${new Date().toLocaleTimeString('es-AR')}\n`);
    if (!imprimirEstado()) {
      clearInterval(intervalo);
      process.exit(0);
    }
  }, 3000);
}

async function main() {
  const [cmd, ...extra] = process.argv.slice(2);
  if (cmd === 'on') await encender(extra);
  else if (cmd === 'off') await apagar();
  else if (cmd === 'status') estado(extra);
  else {
    console.log('Uso: node carga.js <on|off|status>   (o: npm run on / off / status)');
    process.exit(cmd ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
