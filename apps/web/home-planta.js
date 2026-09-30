const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const POLL_INTERVAL_MS = 15000;
// Mismo límite que el backend (estado.repository): una lectura de más de 5 min se considera desactualizada.
const LIMITE_DESACTUALIZADO_S = 5 * 60;
// Home compartido por Admin, Supervisor y Seguridad e Higiene: cada HTML indica en
// <body data-historial="..."> a qué pantalla de historial llevan las tarjetas (?empleado=<id>).
// El backend ya limita /estado/trabajadores-activos al alcance de cada supervisor.
const HISTORIAL_URL = document.body.dataset.historial || 'Admin-HistorialEmpleado.html';

// Estado de cada tarjeta → color del dibujo, etiqueta del chip, grupo del filtro y orden.
// Es el único lugar donde se define el mapeo: cambiar un color acá lo cambia en toda la pantalla.
const ESTADOS = {
  super_emergencia: { label: 'Súper emergencia', color: '#ff1a1a', grupo: 'critico', rank: -2 },
  emergencia: { label: 'Emergencia', color: '#ef4444', grupo: 'critico', rank: -1 },
  sobreesfuerzo: { label: 'Sobreesfuerzo', color: '#fb923c', grupo: 'critico', rank: 0 },
  fatiga: { label: 'Fatiga', color: '#f87171', grupo: 'advertencia', rank: 1 },
  inactividad: { label: 'Inactividad prolongada', color: '#60a5fa', grupo: 'advertencia', rank: 2 },
  normal: { label: 'Normal', color: '#4ade80', grupo: 'normal', rank: 3 },
  sin_datos: { label: 'Sin datos', color: '#9ca3af', grupo: 'sin_datos', rank: 4 },
};
// Tipo de alerta activa → estado. Si hay varias, gana la de menor rank (SUPER_EMERGENCIA > EMERGENCIA > SOBREESFUERZO > FATIGA > INACTIVIDAD).
const ALERTA_A_ESTADO = { SUPER_EMERGENCIA: 'super_emergencia', EMERGENCIA: 'emergencia', SOBREESFUERZO: 'sobreesfuerzo', FATIGA: 'fatiga', INACTIVIDAD_PROLONGADA: 'inactividad' };

const AVATARES = {
  masculino: 'assets/avatars/avatar-hombre.png',
  femenino: 'assets/avatars/avatar-mujer.png',
  neutro: 'assets/avatars/avatar-neutro.svg',
};

// Turno en curso con la hora de la planta (Argentina), mismas franjas que Gestión de
// Empleados: de 20:00 a 08:00 se toma el turno noche (el último del día).
function turnoActual() {
  const horaAR = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (horaAR >= 8 && horaAR < 12) return 'mañana';
  if (horaAR >= 12 && horaAR < 16) return 'tarde';
  return 'noche';
}

// Qué operarios ve cada rol (el alcance del supervisor ya lo aplica el backend):
// - admin: sólo el turno en curso.
// - supervisor: su área y todos los turnos que tiene a cargo.
// - seguridad: todas las áreas y todos los turnos.
function alcanceDelRol() {
  const rol = String(sessionStorage.getItem('userRole') || '').trim().toLowerCase();
  if (rol === 'supervisor') {
    const area = sessionStorage.getItem('userSupervisorArea') || '';
    let turnos = [];
    try { turnos = JSON.parse(sessionStorage.getItem('userSupervisorTurnos') || '[]'); } catch { turnos = []; }
    turnos = Array.isArray(turnos) ? turnos.map((turno) => String(turno).toLowerCase()) : [];
    return {
      incluye: (item) => Boolean(area) && item.area === area && turnos.includes(String(item.turno || '').toLowerCase()),
      titulo: area ? `Área ${area}` : 'Sin área asignada',
      detalle: turnos.length ? `Turnos a cargo: ${turnos.join(', ')} · los casos prioritarios aparecen primero` : 'No tenés turnos asignados',
    };
  }
  if (rol === 'seguridad') {
    return { incluye: () => true, titulo: 'Todos los turnos', detalle: 'Todas las áreas y turnos · los casos prioritarios aparecen primero' };
  }
  const turno = turnoActual();
  return {
    incluye: (item) => String(item.turno || '').toLowerCase() === turno,
    titulo: `Turno ${turno}`,
    detalle: 'Sólo el turno en curso · los casos prioritarios aparecen primero',
  };
}

let trabajadores = [];
let filtroActual = 'todos';
let busquedaActual = '';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function nombreCompleto(item) {
  return `${item.nombre || item.operario_nombre || ''} ${item.apellido || item.operario_apellido || ''}`.trim() || `Trabajador ${item.id_trabajador ?? ''}`.trim();
}

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  return partes.length ? partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() : 'SP';
}

// "18/9, 12:43 p. m." en hora argentina.
function fechaHora(value) {
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? '' : fmtAR(fecha, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function hora(value) {
  if (!value) return '--:--';
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? '--:--' : fmtARHora(fecha, { hour: '2-digit', minute: '2-digit' });
}

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; throw new Error('Sesión expirada'); }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudo cargar el panel.');
  return payload;
}

function tieneLecturaReciente(item) {
  return item.id_medicion != null && item.segundos_desde_ultima_lectura != null
    && Number(item.segundos_desde_ultima_lectura) <= LIMITE_DESACTUALIZADO_S;
}

// 1) alerta activa (la de mayor prioridad), 2) sin lectura reciente → sin datos,
// 3) FC actual contra sus umbrales (el particular si tiene, si no el global).
function calcularEstado(item, alertasPorTrabajador) {
  const tipos = [...(alertasPorTrabajador.get(String(item.id_trabajador)) || []), item.tipo_alerta];
  const porAlerta = tipos
    .map((tipo) => ALERTA_A_ESTADO[String(tipo || '').toUpperCase()])
    .filter(Boolean)
    .sort((a, b) => ESTADOS[a].rank - ESTADOS[b].rank)[0];
  if (porAlerta) return porAlerta;
  if (!tieneLecturaReciente(item) || item.frecuencia_cardiaca == null) return 'sin_datos';

  const fc = Number(item.frecuencia_cardiaca);
  const sobreesfuerzo = item.fc_sobreesfuerzo_particular ?? item.fc_sobreesfuerzo;
  const fatiga = item.fc_fatiga_particular ?? item.fc_fatiga;
  if (sobreesfuerzo != null && fc >= Number(sobreesfuerzo)) return 'sobreesfuerzo';
  if (fatiga != null && fc >= Number(fatiga)) return 'fatiga';
  return 'normal';
}

function descripcionEstado(item) {
  if (item.estado === 'sin_datos') {
    return item.fecha_hora ? `Última lectura: ${fechaHora(item.fecha_hora)}` : 'Sin datos biométricos disponibles';
  }
  if (item.estado === 'normal') return 'Lecturas dentro de los parámetros';
  if (item.estado === 'inactividad') return 'Inactividad prolongada';
  return `${ESTADOS[item.estado].label}${item.frecuencia_cardiaca != null ? ` · ${item.frecuencia_cardiaca} BPM` : ''}`;
}

function renderSummary() {
  const porGrupo = trabajadores.reduce((acc, item) => { const { grupo } = ESTADOS[item.estado]; acc[grupo] = (acc[grupo] || 0) + 1; return acc; }, {});
  const asignados = trabajadores.filter((item) => item.id_dispositivo != null).length;
  document.getElementById('kpiTrabajadores').textContent = trabajadores.length;
  document.getElementById('kpiAtencion').textContent = (porGrupo.critico || 0) + (porGrupo.advertencia || 0);
  document.getElementById('kpiCritico').textContent = porGrupo.critico || 0;
  document.getElementById('kpiDispositivos').textContent = `${asignados}/${trabajadores.length}`;
  [['Todos', trabajadores.length], ['Critico', porGrupo.critico || 0], ['Advertencia', porGrupo.advertencia || 0], ['Normal', porGrupo.normal || 0], ['SinDatos', porGrupo.sin_datos || 0]]
    .forEach(([key, value]) => { document.getElementById(`filter${key}`).textContent = value; });
}

function renderCard(item) {
  const config = ESTADOS[item.estado];
  const nombre = nombreCompleto(item);
  const avatar = AVATARES[String(item.sexo || '').toLowerCase()] || AVATARES.neutro;
  const reciente = tieneLecturaReciente(item) && item.frecuencia_cardiaca != null;
  const subtitulo = [item.legajo, item.area].filter(Boolean).join(' · ') || 'Operario';
  const lectura = `<div class="op-card__fc${reciente ? '' : ' op-card__fc--vacia'}"><strong>${reciente ? escapeHtml(item.frecuencia_cardiaca) : '—'}</strong> <small>BPM</small></div>`;

  // El dibujo ocupa toda la tarjeta; encima: FC actual arriba a la derecha y abajo, sobre el
  // torso, el nombre y el estado. El avatar se pinta con el color del estado (mask +
  // ilustración con multiply: el relleno blanco toma el color y las líneas quedan negras).
  return `<a class="op-card${item.estado === 'emergencia' ? ' op-card--emergencia' : ''}${item.estado === 'super_emergencia' ? ' op-card--super-emergencia' : ''}" href="${HISTORIAL_URL}?empleado=${encodeURIComponent(item.id_trabajador)}" style="--estado:${config.color}" aria-label="Ver historial de ${escapeHtml(nombre)}" title="${escapeHtml(subtitulo)}">
    <div class="op-avatar" style="-webkit-mask-image:url('${avatar}');mask-image:url('${avatar}')"><img src="${avatar}" alt="" /></div>
    <div class="op-card__lectura">${lectura}</div>
    <div class="op-card__pie">
      <h4 class="op-card__nombre">${escapeHtml(nombre)}</h4>
      ${item.area ? `<p class="op-card__area">${escapeHtml(item.area)}</p>` : ''}
      <span class="op-chip"><i></i>${escapeHtml(config.label)}</span>
    </div>
  </a>`;
}

function renderGrid() {
  const grid = document.getElementById('workerGrid');
  const busqueda = busquedaActual.toLocaleLowerCase();
  const filtrados = trabajadores
    .filter((item) => (filtroActual === 'todos' || ESTADOS[item.estado].grupo === filtroActual)
      && (nombreCompleto(item).toLocaleLowerCase().includes(busqueda) || String(item.legajo || '').toLocaleLowerCase().includes(busqueda)))
    .sort((a, b) => ESTADOS[a.estado].rank - ESTADOS[b.estado].rank
      || (Number(b.frecuencia_cardiaca) || 0) - (Number(a.frecuencia_cardiaca) || 0)
      || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  grid.innerHTML = filtrados.length
    ? filtrados.map(renderCard).join('')
    : '<div class="supervisor-empty">No hay operarios que coincidan con el filtro seleccionado.</div>';
}

function renderAlerts() {
  const alertas = trabajadores
    .filter((item) => ['critico', 'advertencia'].includes(ESTADOS[item.estado].grupo))
    .sort((a, b) => ESTADOS[a.estado].rank - ESTADOS[b.estado].rank);
  document.getElementById('alertList').innerHTML = alertas.length
    ? alertas.map((item) => `<div class="supervisor-alert-item supervisor-alert-item--${ESTADOS[item.estado].grupo === 'critico' ? 'critico' : 'advertencia'}"><span class="status-indicator"></span><div><strong>${escapeHtml(nombreCompleto(item))}</strong><span>${escapeHtml(descripcionEstado(item))}</span></div><time>${escapeHtml(hora(item.alerta_fecha_hora || item.fecha_hora))}</time></div>`).join('')
    : '<div class="supervisor-empty supervisor-empty--small">No hay alertas activas.</div>';
}

function renderConnectivity() {
  const offline = trabajadores.filter((item) => item.estado === 'sin_datos');
  document.getElementById('offlineCount').textContent = offline.length;
  document.getElementById('connectivityList').innerHTML = offline.length
    ? offline.map((item) => `<div class="supervisor-connectivity-item"><div class="worker-avatar worker-avatar--small">${escapeHtml(iniciales(nombreCompleto(item)))}</div><div><strong>${escapeHtml(nombreCompleto(item))}</strong><span>${escapeHtml(descripcionEstado(item))}</span></div></div>`).join('')
    : '<div class="supervisor-empty supervisor-empty--small">Todos los operarios tienen lecturas recientes.</div>';
}

function renderAll() {
  renderSummary();
  renderGrid();
  renderAlerts();
  renderConnectivity();
  document.getElementById('currentDate').textContent = `Actualizado ${fmtARHora(new Date(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

// ---- Modal de SÚPER EMERGENCIA ------------------------------------------------
// Aparece grande en el centro mientras haya una SUPER_EMERGENCIA activa en el alcance del
// rol, para atenderla ahí mismo (PATCH /alertas/:id -> 'Atendida'). "Posponer" la oculta un
// minuto; si sigue activa, vuelve a aparecer.
const POSPONER_SUPER_MS = 60000;
const superPospuestas = new Map(); // id de alerta -> timestamp hasta el que queda oculta
let superMostrada = null; // id de la alerta con el modal abierto

function superOverlay() {
  let overlay = document.getElementById('superModal');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'superModal';
  overlay.className = 'super-modal';
  overlay.hidden = true;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'superModalTitulo');
  overlay.innerHTML = `<div class="super-modal__panel">
    <p class="super-modal__pendientes" id="superModalPendientes" hidden></p>
    <h2 class="super-modal__titulo" id="superModalTitulo">Súper emergencia</h2>
    <p class="super-modal__nombre" id="superModalNombre"></p>
    <p class="super-modal__area" id="superModalArea"></p>
    <div class="super-modal__fc"><strong id="superModalFc">—</strong> <small>BPM</small></div>
    <p class="super-modal__texto">Más de dos emergencias en la última hora. Requiere atención inmediata.</p>
    <p class="super-modal__error" id="superModalError" role="status" hidden></p>
    <div class="super-modal__acciones">
      <button type="button" class="super-modal__btn super-modal__btn--atender" id="superModalAtender">Atender alerta</button>
      <a class="super-modal__btn super-modal__btn--link" id="superModalHistorial" href="#">Ver historial</a>
      <button type="button" class="super-modal__btn super-modal__btn--posponer" id="superModalPosponer">Posponer 1 min</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#superModalAtender').addEventListener('click', atenderSuper);
  overlay.querySelector('#superModalPosponer').addEventListener('click', posponerSuper);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) posponerSuper();
  });
  return overlay;
}

function cerrarSuper() {
  const overlay = superOverlay();
  overlay.hidden = true;
  document.body.classList.remove('super-modal-abierto');
  superMostrada = null;
}

function posponerSuper() {
  if (superMostrada != null) superPospuestas.set(superMostrada, Date.now() + POSPONER_SUPER_MS);
  cerrarSuper();
}

async function atenderSuper() {
  const id = superMostrada;
  if (id == null) return;
  const overlay = superOverlay();
  const boton = overlay.querySelector('#superModalAtender');
  const error = overlay.querySelector('#superModalError');
  boton.disabled = true;
  error.hidden = true;
  try {
    await apiFetch(`/alertas/${id}`, { method: 'PATCH', body: JSON.stringify({ estado: 'Atendida' }) });
    cerrarSuper();
    await cargarHome();
  } catch (err) {
    error.textContent = err.message || 'No se pudo atender la alerta.';
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

function actualizarModalSuper(alertas) {
  const ahora = Date.now();
  const candidatas = alertas
    .filter((alerta) => String(alerta.tipo_alerta || '').toUpperCase() === 'SUPER_EMERGENCIA')
    .map((alerta) => ({ alerta, trabajador: trabajadores.find((item) => String(item.id_trabajador) === String(alerta.id_trabajador)) }))
    .filter(({ alerta, trabajador }) => trabajador && (superPospuestas.get(alerta.id) || 0) <= ahora);
  if (!candidatas.length) { if (superMostrada != null) cerrarSuper(); return; }

  const { alerta, trabajador } = candidatas[0];
  const overlay = superOverlay();
  const reciente = tieneLecturaReciente(trabajador) && trabajador.frecuencia_cardiaca != null;
  overlay.querySelector('#superModalFc').textContent = reciente ? trabajador.frecuencia_cardiaca : '—';
  const pendientes = overlay.querySelector('#superModalPendientes');
  pendientes.textContent = `+${candidatas.length - 1} súper emergencia${candidatas.length - 1 === 1 ? '' : 's'} más`;
  pendientes.hidden = candidatas.length < 2;

  if (superMostrada === alerta.id) return; // mismo caso: sólo se refrescó la FC, sin robar el foco
  superMostrada = alerta.id;
  overlay.querySelector('#superModalNombre').textContent = nombreCompleto(trabajador);
  overlay.querySelector('#superModalArea').textContent = [trabajador.legajo, trabajador.area].filter(Boolean).join(' · ') || 'Operario';
  overlay.querySelector('#superModalHistorial').href = `${HISTORIAL_URL}?empleado=${encodeURIComponent(trabajador.id_trabajador)}`;
  overlay.querySelector('#superModalError').hidden = true;
  overlay.hidden = false;
  document.body.classList.add('super-modal-abierto');
  overlay.querySelector('#superModalAtender').focus();
}

async function cargarHome() {
  try {
    const [estadoResult, alertasResult] = await Promise.allSettled([apiFetch('/estado/trabajadores-activos'), apiFetch('/alertas/activas')]);
    if (estadoResult.status === 'rejected') throw estadoResult.reason;
    if (alertasResult.status === 'rejected') console.error(alertasResult.reason);

    const alertasPorTrabajador = new Map();
    (alertasResult.status === 'fulfilled' ? alertasResult.value?.data || [] : []).forEach((alerta) => {
      const clave = String(alerta.id_trabajador);
      if (!alertasPorTrabajador.has(clave)) alertasPorTrabajador.set(clave, []);
      alertasPorTrabajador.get(clave).push(alerta.tipo_alerta);
    });

    const alcance = alcanceDelRol();
    const data = (Array.isArray(estadoResult.value?.data) ? estadoResult.value.data : []).filter(alcance.incluye);
    document.getElementById('turnoActual').textContent = alcance.titulo;
    document.getElementById('alcanceDetalle').textContent = alcance.detalle;
    trabajadores = data.map((item) => ({ ...item, estado: calcularEstado(item, alertasPorTrabajador) }));
    renderAll();
    actualizarModalSuper(alertasResult.status === 'fulfilled' ? alertasResult.value?.data || [] : []);
  } catch (error) {
    console.error(error);
    document.getElementById('workerGrid').innerHTML = `<div class="supervisor-empty supervisor-empty--error">${escapeHtml(error.message)}</div>`;
  }
}

document.querySelectorAll('.supervisor-filter').forEach((button) => button.addEventListener('click', () => {
  filtroActual = button.dataset.filter;
  document.querySelectorAll('.supervisor-filter').forEach((item) => item.classList.toggle('is-active', item === button));
  renderGrid();
}));
document.getElementById('workerSearch').addEventListener('input', (event) => { busquedaActual = event.target.value.trim(); renderGrid(); });

cargarHome();
setInterval(cargarHome, POLL_INTERVAL_MS);
