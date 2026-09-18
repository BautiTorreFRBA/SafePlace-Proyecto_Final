const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const POLL_INTERVAL_MS = 15000;
const ESTADOS = {
  critico: { label: 'Crítico', badge: 'badge--critical', tone: 'critical', rank: 0 },
  advertencia: { label: 'Advertencia', badge: 'badge--warning', tone: 'warning', rank: 1 },
  normal: { label: 'Normal', badge: 'badge--normal', tone: 'normal', rank: 2 },
  desactualizado: { label: 'Desactualizado', badge: 'badge--warning', tone: 'offline', rank: 3 },
  sin_datos: { label: 'Sin datos', badge: 'badge--neutral', tone: 'offline', rank: 4 },
};

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

function fechaHora(value) {
  if (!value) return 'Sin lectura';
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? 'Sin lectura' : fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function hora(value) {
  if (!value) return '--:--';
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? '--:--' : fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function estadoDe(item) { return ESTADOS[item.estado_actual] ? item.estado_actual : 'sin_datos'; }

function descripcionEstado(item, estado) {
  if (item.estado_descripcion) return item.estado_descripcion;
  if (estado === 'critico') return 'Requiere atención inmediata';
  if (estado === 'advertencia') return 'Controlar evolución';
  if (estado === 'desactualizado') return 'No se recibió una lectura reciente';
  if (estado === 'sin_datos') return 'Sin datos biométricos disponibles';
  return 'Lecturas dentro de los parámetros';
}

async function apiFetch(path) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; throw new Error('Sesión expirada'); }
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudo cargar el panel.');
  return payload;
}

function createHomeLayout() {
  const main = document.querySelector('.main');
  const topbar = main.querySelector('.topbar');
  main.querySelectorAll(':scope > *:not(.topbar)').forEach((node) => node.remove());
  topbar.insertAdjacentHTML('afterend', `
    <div class="supervisor-welcome"><div><h2 class="supervisor-welcome__title">Estado de la planta</h2><p class="supervisor-welcome__subtitle">Priorización de operarios según sus últimas mediciones</p></div><div class="supervisor-welcome__status"><span class="live-dot"></span><span id="currentDate">Actualizando...</span></div></div>
    <section class="supervisor-summary" aria-label="Resumen operativo">
      <div class="supervisor-summary__item"><span class="summary-value" id="kpiTrabajadores">--</span><span>monitoreados</span></div><div class="supervisor-summary__item supervisor-summary__item--warning"><span class="summary-value" id="kpiAlertas">--</span><span>requieren atención</span></div><div class="supervisor-summary__item supervisor-summary__item--critical"><span class="summary-value" id="kpiCritico">--</span><span>en estado crítico</span></div><div class="supervisor-summary__item"><span class="summary-value" id="kpiDispositivos">--</span><span>dispositivos asignados</span></div>
    </section>
    <section class="supervisor-panel"><div class="supervisor-panel__header"><div><h3>Operarios monitoreados</h3><p>Los casos prioritarios aparecen primero</p></div><label class="supervisor-search"><span aria-hidden="true">⌕</span><input id="workerSearch" type="search" placeholder="Buscar operario..." autocomplete="off" /></label></div>
      <div class="supervisor-filters" role="group" aria-label="Filtrar operarios"><button class="supervisor-filter is-active" type="button" data-filter="todos">Todos <span id="filterTodos">0</span></button><button class="supervisor-filter" type="button" data-filter="critico">Críticos <span id="filterCritico">0</span></button><button class="supervisor-filter" type="button" data-filter="advertencia">Advertencia <span id="filterAdvertencia">0</span></button><button class="supervisor-filter" type="button" data-filter="normal">Normales <span id="filterNormal">0</span></button><button class="supervisor-filter" type="button" data-filter="sin_datos">Sin datos <span id="filterSinDatos">0</span></button></div>
      <div class="worker-cards" id="workerCards" aria-live="polite"></div>
    </section>
    <section class="supervisor-bottom-grid"><div class="supervisor-panel supervisor-panel--compact"><div class="supervisor-panel__header"><div><h3>Alertas activas</h3><p>Situaciones que requieren seguimiento</p></div><span class="badge badge--neutral">Tiempo real</span></div><div class="supervisor-alert-list" id="alertList"></div></div><div class="supervisor-panel supervisor-panel--compact"><div class="supervisor-panel__header"><div><h3>Conectividad</h3><p>Operarios sin lectura reciente</p></div><span class="badge badge--neutral" id="offlineCount">0</span></div><div class="supervisor-connectivity-list" id="connectivityList"></div></div></section>`);
}

function renderSummary() {
  const counts = trabajadores.reduce((result, item) => { const estado = estadoDe(item); result[estado] = (result[estado] || 0) + 1; return result; }, {});
  const conAtencion = (counts.critico || 0) + (counts.advertencia || 0);
  const asignados = trabajadores.filter((item) => item.id_dispositivo !== null && item.id_dispositivo !== undefined).length;
  document.getElementById('kpiTrabajadores').textContent = trabajadores.length;
  document.getElementById('kpiAlertas').textContent = conAtencion;
  document.getElementById('kpiCritico').textContent = counts.critico || 0;
  document.getElementById('kpiDispositivos').textContent = `${asignados}/${trabajadores.length}`;
  [['Todos', trabajadores.length], ['Critico', counts.critico || 0], ['Advertencia', counts.advertencia || 0], ['Normal', counts.normal || 0], ['SinDatos', (counts.sin_datos || 0) + (counts.desactualizado || 0)]].forEach(([key, value]) => { document.getElementById(`filter${key}`).textContent = value; });
}

function renderWorkerCard(item) {
  const estado = estadoDe(item); const config = ESTADOS[estado]; const nombre = nombreCompleto(item); const dispositivo = item.id_dispositivo !== null && item.id_dispositivo !== undefined;
  const bpm = item.frecuencia_cardiaca ?? '--'; const fatiga = item.fc_fatiga ?? item.umbral_fatiga ?? '--'; const sobreesfuerzo = item.fc_sobreesfuerzo ?? item.umbral_sobreesfuerzo ?? '--';
  return `<article class="worker-card worker-card--${config.tone} ${estado === 'critico' ? 'worker-card--attention' : ''}"><div class="worker-card__identity"><div class="worker-avatar">${escapeHtml(iniciales(nombre))}</div><div><h4>${escapeHtml(nombre)}</h4><p>${escapeHtml(item.legajo ? `Legajo ${item.legajo}` : 'Operario')}${item.area ? ` · ${escapeHtml(item.area)}` : ''}</p></div></div><div class="worker-card__status"><span class="status-indicator"></span><span>${escapeHtml(config.label)}</span><strong>${escapeHtml(descripcionEstado(item, estado))}</strong></div><div class="worker-card__metrics"><div><span>Frecuencia actual</span><strong class="worker-card__bpm">${escapeHtml(bpm)} <small>BPM</small></strong></div><div><span>Umbral fatiga</span><strong>${escapeHtml(fatiga)} <small>BPM</small></strong></div><div><span>Umbral sobreesfuerzo</span><strong>${escapeHtml(sobreesfuerzo)} <small>BPM</small></strong></div></div><div class="worker-card__footer"><span class="worker-card__reading ${dispositivo ? 'is-connected' : 'is-disconnected'}"><span></span>${dispositivo ? 'Wearable asignado' : 'Sin wearable'}</span><span>Última lectura: <strong>${escapeHtml(fechaHora(item.fecha_hora))}</strong></span></div></article>`;
}

function renderWorkers() {
  const container = document.getElementById('workerCards');
  const filtered = trabajadores.filter((item) => { const estado = estadoDe(item); const matchesFilter = filtroActual === 'todos' || (filtroActual === 'sin_datos' ? ['sin_datos', 'desactualizado'].includes(estado) : estado === filtroActual); return matchesFilter && nombreCompleto(item).toLocaleLowerCase().includes(busquedaActual.toLocaleLowerCase()); }).sort((a, b) => ESTADOS[estadoDe(a)].rank - ESTADOS[estadoDe(b)].rank || (Number(b.frecuencia_cardiaca) || 0) - (Number(a.frecuencia_cardiaca) || 0));
  container.innerHTML = filtered.length ? filtered.map(renderWorkerCard).join('') : '<div class="supervisor-empty">No hay operarios que coincidan con el filtro seleccionado.</div>';
}

function renderAlerts() {
  const alertas = trabajadores.filter((item) => ['critico', 'advertencia'].includes(estadoDe(item))).sort((a, b) => ESTADOS[estadoDe(a)].rank - ESTADOS[estadoDe(b)].rank);
  document.getElementById('alertList').innerHTML = alertas.length ? alertas.map((item) => `<div class="supervisor-alert-item supervisor-alert-item--${estadoDe(item)}"><span class="status-indicator"></span><div><strong>${escapeHtml(nombreCompleto(item))}</strong><span>${escapeHtml(descripcionEstado(item, estadoDe(item)))}</span></div><time>${escapeHtml(hora(item.alerta_fecha_hora || item.fecha_hora))}</time></div>`).join('') : '<div class="supervisor-empty supervisor-empty--small">No hay alertas activas.</div>';
}

function renderConnectivity() {
  const offline = trabajadores.filter((item) => ['desactualizado', 'sin_datos'].includes(estadoDe(item)));
  document.getElementById('offlineCount').textContent = offline.length;
  document.getElementById('connectivityList').innerHTML = offline.length ? offline.map((item) => `<div class="supervisor-connectivity-item"><div class="worker-avatar worker-avatar--small">${escapeHtml(iniciales(nombreCompleto(item)))}</div><div><strong>${escapeHtml(nombreCompleto(item))}</strong><span>${escapeHtml(descripcionEstado(item, estadoDe(item)))}</span></div></div>`).join('') : '<div class="supervisor-empty supervisor-empty--small">Todos los dispositivos están reportando.</div>';
}

function renderAll() { renderSummary(); renderWorkers(); renderAlerts(); renderConnectivity(); document.getElementById('currentDate').textContent = `Actualizado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`; }

async function cargarHome() {
  try { const payload = await apiFetch('/estado/trabajadores-activos'); trabajadores = Array.isArray(payload?.data) ? payload.data : []; renderAll(); }
  catch (error) { console.error(error); document.getElementById('workerCards').innerHTML = `<div class="supervisor-empty supervisor-empty--error">${escapeHtml(error.message)}</div>`; }
}

createHomeLayout();
document.querySelectorAll('.supervisor-filter').forEach((button) => button.addEventListener('click', () => { filtroActual = button.dataset.filter; document.querySelectorAll('.supervisor-filter').forEach((item) => item.classList.toggle('is-active', item === button)); renderWorkers(); }));
document.getElementById('workerSearch').addEventListener('input', (event) => { busquedaActual = event.target.value.trim(); renderWorkers(); });
cargarHome();
setInterval(cargarHome, POLL_INTERVAL_MS);
