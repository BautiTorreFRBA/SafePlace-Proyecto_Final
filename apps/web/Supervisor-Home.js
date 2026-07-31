const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const POLL_INTERVAL_MS = 15000;

const workerList = document.getElementById('workerList');
const alertList = document.getElementById('alertList');
const kpiTrabajadores = document.getElementById('kpiTrabajadores');
const kpiAlertas = document.getElementById('kpiAlertas');
const kpiCritico = document.getElementById('kpiCritico');
const kpiDispositivos = document.getElementById('kpiDispositivos');
const currentDate = document.getElementById('currentDate');

const ESTADO_CONFIG = {
  normal: { label: 'Normal', badge: 'badge--normal', dot: 'dot--green' },
  advertencia: { label: 'Advertencia', badge: 'badge--warning', dot: 'dot--orange' },
  critico: { label: 'Crítico', badge: 'badge--critical', dot: 'dot--red' },
  desactualizado: { label: 'Desactualizado', badge: 'badge--warning', dot: 'dot--orange' },
  sin_datos: { label: 'Sin datos', badge: 'badge--neutral', dot: 'dot--orange' },
};

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'InicioSesion.html';
    return null;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'No se pudo completar la operacion.');
  }

  return payload;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nombreCompleto(item) {
  return `${item.nombre || item.operario_nombre || ''} ${item.apellido || item.operario_apellido || ''}`.trim() || `Trabajador ${item.id_trabajador ?? ''}`.trim();
}

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'SP';
  return partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
}

function formatearFechaHora(value) {
  if (!value) return '--';
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return '--';
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatearNumero(value, sufijo = '') {
  if (value === null || value === undefined || value === '') return '--';
  return `${value}${sufijo}`;
}

function actualizarFechaActualizacion() {
  if (!currentDate) return;
  const now = new Date();
  currentDate.textContent = `Estado del sistema al ${now.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function renderKPIs(trabajadores) {
  const total = trabajadores.length;
  const alertas = trabajadores.filter((item) => item.estado_actual === 'advertencia' || item.estado_actual === 'critico').length;
  const criticos = trabajadores.filter((item) => item.estado_actual === 'critico').length;
  const conDispositivo = trabajadores.filter((item) => item.id_dispositivo !== null && item.id_dispositivo !== undefined).length;

  kpiTrabajadores.textContent = String(total);
  kpiAlertas.textContent = String(alertas);
  kpiCritico.textContent = String(criticos);
  kpiDispositivos.textContent = `${conDispositivo}/${total || 0}`;
}

function renderAlertas(trabajadores) {
  const alertas = trabajadores.filter((item) => item.estado_actual === 'advertencia' || item.estado_actual === 'critico');

  if (alertas.length === 0) {
    alertList.innerHTML = '<li class="alert-item"><div class="alert-item__info"><strong>No hay alertas activas</strong><span>Todo el panel se encuentra en estado normal</span></div></li>';
    return;
  }

  alertList.innerHTML = alertas.map((item) => {
    const config = ESTADO_CONFIG[item.estado_actual] || ESTADO_CONFIG.normal;
    const descripcion = item.estado_descripcion || config.label;
    return `
      <li class="alert-item">
        <span class="dot ${config.dot}"></span>
        <div class="alert-item__info">
          <strong>${escapeHtml(nombreCompleto(item))}</strong>
          <span>${escapeHtml(descripcion)}</span>
        </div>
        <span class="badge ${config.badge}">${escapeHtml(config.label)}</span>
      </li>
    `;
  }).join('');
}

function renderTrabajadores(trabajadores) {
  if (trabajadores.length === 0) {
    workerList.innerHTML = '<li class="worker-item"><div class="worker-item__info"><strong>Sin trabajadores monitoreados</strong><span>No hay datos biométricos disponibles</span></div></li>';
    return;
  }

  workerList.innerHTML = trabajadores.map((item) => {
    const config = ESTADO_CONFIG[item.estado_actual] || ESTADO_CONFIG.normal;
    const nombre = nombreCompleto(item);
    const lectura = [
      `${formatearNumero(item.frecuencia_cardiaca)} BPM`,
      `${formatearNumero(item.temperatura_corporal, ' C')}`,
      `${formatearNumero(item.spo2, '%')}`,
    ].join(' · ');
    const detalle = [item.area ? `Area ${item.area}` : null, lectura, formatearFechaHora(item.fecha_hora)]
      .filter(Boolean)
      .join(' · ');

    return `
      <li class="worker-item">
        <div class="avatar avatar--sm">${escapeHtml(iniciales(nombre))}</div>
        <div class="worker-item__info">
          <strong>${escapeHtml(nombre)}${item.legajo ? ` - ${escapeHtml(item.legajo)}` : ''}</strong>
          <span>${escapeHtml(detalle)}</span>
        </div>
        <span class="badge ${config.badge}">${escapeHtml(config.label)}</span>
      </li>
    `;
  }).join('');
}

async function cargarEstadoTrabajadores() {
  const payload = await apiFetch('/estado/trabajadores-activos');
  const trabajadores = payload.data || [];

  renderKPIs(trabajadores);
  renderAlertas(trabajadores);
  renderTrabajadores(trabajadores);
  actualizarFechaActualizacion();
}

async function inicializar() {
  actualizarFechaActualizacion();
  await cargarEstadoTrabajadores();
  setInterval(() => {
    cargarEstadoTrabajadores().catch((error) => {
      console.error(error);
      workerList.innerHTML = `<li class="worker-item"><div class="worker-item__info"><strong>Error</strong><span>${escapeHtml(error.message)}</span></div></li>`;
      alertList.innerHTML = `<li class="alert-item"><div class="alert-item__info"><strong>No se pudo actualizar el panel</strong><span>${escapeHtml(error.message)}</span></div></li>`;
    });
  }, POLL_INTERVAL_MS);
}

inicializar().catch((error) => {
  console.error(error);
  workerList.innerHTML = `<li class="worker-item"><div class="worker-item__info"><strong>Error</strong><span>${escapeHtml(error.message)}</span></div></li>`;
  alertList.innerHTML = `<li class="alert-item"><div class="alert-item__info"><strong>No se pudo cargar el panel</strong><span>${escapeHtml(error.message)}</span></div></li>`;
});
