const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const POLL_INTERVAL_MS = 15000;
// Mismo límite que el backend (estado.repository): una lectura de más de 5 min se considera desactualizada.
const LIMITE_DESACTUALIZADO_S = 5 * 60;
const HISTORIAL_URL = 'Admin-HistorialEmpleado.html';

// Estado de cada tarjeta → color del dibujo, etiqueta del chip, grupo del filtro y orden.
// Es el único lugar donde se define el mapeo: cambiar un color acá lo cambia en toda la pantalla.
const ESTADOS = {
  sobreesfuerzo: { label: 'Sobreesfuerzo', color: '#fb923c', grupo: 'critico', rank: 0 },
  fatiga: { label: 'Fatiga', color: '#f87171', grupo: 'advertencia', rank: 1 },
  inactividad: { label: 'Inactividad prolongada', color: '#60a5fa', grupo: 'advertencia', rank: 2 },
  normal: { label: 'Normal', color: '#4ade80', grupo: 'normal', rank: 3 },
  sin_datos: { label: 'Sin datos', color: '#9ca3af', grupo: 'sin_datos', rank: 4 },
};
// Tipo de alerta activa → estado. Si hay varias, gana la de menor rank (SOBREESFUERZO > FATIGA > INACTIVIDAD).
const ALERTA_A_ESTADO = { SOBREESFUERZO: 'sobreesfuerzo', FATIGA: 'fatiga', INACTIVIDAD_PROLONGADA: 'inactividad' };

const AVATARES = {
  masculino: 'assets/avatars/avatar-hombre.png',
  femenino: 'assets/avatars/avatar-mujer.png',
  neutro: 'assets/avatars/avatar-neutro.svg',
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

async function apiFetch(path) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; throw new Error('Sesión expirada'); }
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
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
  const lectura = reciente
    ? `<div class="op-card__fc"><strong>${escapeHtml(item.frecuencia_cardiaca)}</strong><small>BPM</small></div>`
    : `<div class="op-card__fc op-card__fc--vacia"><strong>—</strong></div>
       <p class="op-card__sin-lectura">Sin lectura reciente${item.fecha_hora ? `<br><span>Última lectura: ${escapeHtml(fechaHora(item.fecha_hora))}</span>` : ''}</p>`;

  // El avatar se pinta con el color del estado: el contenedor tiene la forma del dibujo (mask)
  // y la ilustración encima con multiply, así el relleno blanco toma el color y las líneas quedan negras.
  return `<a class="op-card" href="${HISTORIAL_URL}?empleado=${encodeURIComponent(item.id_trabajador)}" style="--estado:${config.color}" aria-label="Ver historial de ${escapeHtml(nombre)}">
    <div class="op-avatar" style="-webkit-mask-image:url('${avatar}');mask-image:url('${avatar}')"><img src="${avatar}" alt="" /></div>
    <h4 class="op-card__nombre">${escapeHtml(nombre)}</h4>
    <p class="op-card__meta">${escapeHtml(subtitulo)}</p>
    ${lectura}
    <span class="op-chip"><i></i>${escapeHtml(config.label)}</span>
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

    const data = Array.isArray(estadoResult.value?.data) ? estadoResult.value.data : [];
    trabajadores = data.map((item) => ({ ...item, estado: calcularEstado(item, alertasPorTrabajador) }));
    renderAll();
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
