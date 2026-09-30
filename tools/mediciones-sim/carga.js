#!/usr/bin/env node
'use strict';

/**
 * Encender / apagar la simulación de carga (los 20 operarios a la vez).
 *
 *   node carga.js on       conecta a todos y empieza a mandar mediciones (en segundo plano)
 *   node carga.js off      todos DESCONECTADO y frena
 *   node carga.js status   ¿está encendida? últimos resúmenes
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

function estado() {
  const pid = pidActivo();
  if (!pid) {
    console.log('APAGADA.');
    return;
  }
  console.log(`ENCENDIDA (PID ${pid}).`);
  for (const l of ultimasLineas(3, '[resumen]')) console.log(l);
  const problemas = ultimasLineas(200).filter((l) => /^\[.*\] HTTP|AVISO|sin respuesta del backend/.test(l));
  if (problemas.length) console.log('Problemas detectados:\n  ' + [...new Set(problemas)].slice(-8).join('\n  '));
}

async function main() {
  const [cmd, ...extra] = process.argv.slice(2);
  if (cmd === 'on') await encender(extra);
  else if (cmd === 'off') await apagar();
  else if (cmd === 'status') estado();
  else {
    console.log('Uso: node carga.js <on|off|status>   (o: npm run on / off / status)');
    process.exit(cmd ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
