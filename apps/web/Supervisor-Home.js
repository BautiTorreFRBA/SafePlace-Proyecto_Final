const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const POLL_INTERVAL_MS = 15000;

const workerList = document.getElementById('workerList');
const alertList = document.getElementById('alertList');
const kpiTrabajadores = document.getElementById('kpiTrabajadores');
const kpiAlertas = document.getElementById('kpiAlertas');
const kpiCritico = document.getElementById('kpiCritico');
const kpiDispositivos = document.getElementById('kpiDispositivos');
const currentDate = document.getElementById('currentDate');
const alertsChartCanvas = document.getElementById('alertsChart');
const heartChartCanvas = document.getElementById('heartChart');

const COLORS = {
  teal: '#2dd4bf',
  tealFill: 'rgba(45, 212, 191, 0.12)',
  red: '#f87171',
  orange: '#fb923c',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  grid: 'rgba(255,255,255,0.06)',
  tickColor: '#9ca3af',
  tooltip: '#111827',
};

const ESTADO_CONFIG = {
  normal: { label: 'Normal', badge: 'badge--normal', dot: 'dot--green' },
  advertencia: { label: 'Advertencia', badge: 'badge--warning', dot: 'dot--orange' },
  critico: { label: 'Crítico', badge: 'badge--critical', dot: 'dot--red' },
  desactualizado: { label: 'Desactualizado', badge: 'badge--warning', dot: 'dot--orange' },
  sin_datos: { label: 'Sin datos', badge: 'badge--neutral', dot: 'dot--orange' },
};

const ALERTA_CONFIG = {
  FATIGA: { label: 'Fatiga', color: COLORS.yellow },
  SOBREESFUERZO: { label: 'Sobreesfuerzo', color: COLORS.red },
  INACTIVIDAD_PROLONGADA: { label: 'Inactividad', color: COLORS.blue },
};

const HORAS_FRECUENCIA = [0, 4, 8, 12, 16, 20].map((hora) => ({
  hora,
  label: `${String(hora).padStart(2, '0')}:00`,
}));

let alertsChart = null;
let heartChart = null;

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

function normalizarFechaLocal(date) {
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function obtenerUltimosSieteDias() {
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - (6 - index));
    return normalizarFechaLocal(dia);
  });
}

function formatearEtiquetaDia(isoDate) {
  const [yyyy, mm, dd] = isoDate.split('-').map((value) => Number(value));
  const fecha = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  return fecha.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}

function destruirGraficos() {
  if (alertsChart && typeof alertsChart.destroy === 'function') {
    alertsChart.destroy();
  }
  alertsChart = null;

  if (heartChart && typeof heartChart.destroy === 'function') {
    heartChart.destroy();
  }
  heartChart = null;
}

function renderGraficoAlertas(alertasPorDia) {
  if (!alertsChartCanvas || !window.Chart) return;

  const dias = obtenerUltimosSieteDias();
  const valores = new Map();

  (Array.isArray(alertasPorDia) ? alertasPorDia : []).forEach((row) => {
    const dia = String(row.dia);
    const tipo = String(row.tipo_alerta || '').trim().toUpperCase();
    const total = Number(row.total) || 0;

    if (!valores.has(dia)) {
      valores.set(dia, {});
    }

    valores.get(dia)[tipo] = total;
  });

  const labels = dias.map(formatearEtiquetaDia);
  const datasets = Object.entries(ALERTA_CONFIG).map(([tipo, config]) => ({
    label: config.label,
    data: dias.map((dia) => valores.get(dia)?.[tipo] || 0),
    backgroundColor: config.color,
    borderRadius: 4,
    borderSkipped: false,
  }));

  const ctx = alertsChartCanvas.getContext('2d');
  alertsChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            color: COLORS.tickColor,
          },
        },
        tooltip: {
          backgroundColor: COLORS.tooltip,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: {
            color: COLORS.grid,
            drawBorder: false,
          },
          border: { display: false },
          ticks: { color: COLORS.tickColor },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            color: COLORS.tickColor,
          },
          grid: {
            color: COLORS.grid,
            drawBorder: false,
          },
          border: { display: false },
        },
      },
    },
  });
}

function renderGraficoFrecuencia(frecuenciaPromedioHoy) {
  if (!heartChartCanvas || !window.Chart) return;

  const valores = new Map(
    (Array.isArray(frecuenciaPromedioHoy) ? frecuenciaPromedioHoy : []).map((row) => [
      Number(row.hora_inicio),
      row.promedio === null || row.promedio === undefined ? null : Number(row.promedio),
    ]),
  );

  const labels = HORAS_FRECUENCIA.map((slot) => slot.label);
  const data = HORAS_FRECUENCIA.map((slot) => valores.get(slot.hora) ?? null);

  const ctx = heartChartCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(45, 212, 191, 0.22)');
  gradient.addColorStop(1, 'rgba(45, 212, 191, 0)');

  heartChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'BPM promedio',
        data,
        borderColor: COLORS.teal,
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: COLORS.teal,
        tension: 0.35,
        fill: true,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: COLORS.tooltip,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y ?? '--'} BPM`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: COLORS.grid,
            drawBorder: false,
          },
          border: { display: false },
          ticks: { color: COLORS.tickColor },
        },
        y: {
          min: 50,
          max: 150,
          ticks: {
            stepSize: 25,
            color: COLORS.tickColor,
          },
          grid: {
            color: COLORS.grid,
            drawBorder: false,
          },
          border: { display: false },
        },
      },
    },
  });
}

function renderGraficos(resumen) {
  destruirGraficos();
  renderGraficoAlertas(resumen.alertasPorDia || []);
  renderGraficoFrecuencia(resumen.frecuenciaPromedioHoy || []);
}

async function cargarHome() {
  const [estadoResult, resumenResult] = await Promise.allSettled([
    apiFetch('/estado/trabajadores-activos'),
    apiFetch('/dashboard/summary'),
  ]);

  if (estadoResult.status === 'fulfilled') {
    const trabajadores = estadoResult.value?.data || [];
    renderKPIs(trabajadores);
    renderAlertas(trabajadores);
    renderTrabajadores(trabajadores);
  } else {
    console.error(estadoResult.reason);
    workerList.innerHTML = `<li class="worker-item"><div class="worker-item__info"><strong>Error</strong><span>${escapeHtml(estadoResult.reason?.message || 'No se pudo cargar el panel')}</span></div></li>`;
    alertList.innerHTML = `<li class="alert-item"><div class="alert-item__info"><strong>No se pudo cargar el panel</strong><span>${escapeHtml(estadoResult.reason?.message || 'No se pudo cargar el panel')}</span></div></li>`;
  }

  if (resumenResult.status === 'fulfilled') {
    const resumen = resumenResult.value?.data || {};
    renderGraficos(resumen);
  } else {
    console.error(resumenResult.reason);
    destruirGraficos();
  }

  actualizarFechaActualizacion();
}

async function inicializar() {
  actualizarFechaActualizacion();
  await cargarHome();
  setInterval(() => {
    cargarHome().catch((error) => {
      console.error(error);
    });
  }, POLL_INTERVAL_MS);
}

inicializar().catch((error) => {
  console.error(error);
  workerList.innerHTML = `<li class="worker-item"><div class="worker-item__info"><strong>Error</strong><span>${escapeHtml(error.message)}</span></div></li>`;
  alertList.innerHTML = `<li class="alert-item"><div class="alert-item__info"><strong>No se pudo cargar el panel</strong><span>${escapeHtml(error.message)}</span></div></li>`;
});