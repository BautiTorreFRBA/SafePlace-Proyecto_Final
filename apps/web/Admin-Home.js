const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const POLL_INTERVAL_MS = 30000;

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
    throw new Error(payload.error || payload.message || 'No se pudo completar la operación.');
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
  return `${item.operario_nombre || item.nombre || ''} ${item.operario_apellido || item.apellido || ''}`.trim() || 'Sin asignar';
}

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'SP';
  return partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
}

function esCritica(prioridad) {
  const normalizada = String(prioridad || '').toLowerCase();
  return normalizada.includes('crit');
}

function renderKpis({ trabajadores, alertas, riesgosHoy, dispositivos }) {
  const monitoreados = new Set(trabajadores.map((item) => item.id_trabajador).filter((id) => id != null));
  document.getElementById('kpiTrabajadores').textContent = monitoreados.size;
  document.getElementById('kpiAlertas').textContent = alertas.length;
  document.getElementById('kpiRiesgos').textContent = riesgosHoy.length;

  const conectados = dispositivos.filter((d) => d.ultimo_estado === 'CONECTADO').length;
  document.getElementById('kpiDispositivos').textContent = `${conectados}/${dispositivos.length}`;

  const alertasBadge = document.getElementById('alertasBadge');
  if (alertasBadge) {
    alertasBadge.textContent = `${alertas.length} ${alertas.length === 1 ? 'alerta' : 'alertas'}`;
  }
}

function renderAlertList(alertas) {
  const alertList = document.getElementById('alertList');
  if (!alertList) return;

  if (alertas.length === 0) {
    alertList.innerHTML = '<li class="alert-item"><div class="alert-item__info"><span>No hay alertas activas</span></div></li>';
    return;
  }

  alertList.innerHTML = alertas.slice(0, 6).map((a) => {
    const critica = esCritica(a.prioridad);
    return `<li class="alert-item">
      <span class="dot ${critica ? 'dot--red' : 'dot--orange'}"></span>
      <div class="alert-item__info">
        <strong>${escapeHtml(nombreCompleto(a))}</strong>
        <span>${escapeHtml(a.tipo_alerta || 'Alerta')}</span>
      </div>
      <span class="badge ${critica ? 'badge--critical' : 'badge--warning'}">${escapeHtml(a.prioridad || 'Normal')}</span>
    </li>`;
  }).join('');
}

function renderWorkerList(trabajadores, alertasActivas) {
  const workerList = document.getElementById('workerList');
  if (!workerList) return;

  const alertaPorTrabajador = new Map();
  for (const a of alertasActivas) {
    if (a.id_trabajador == null) continue;
    const actual = alertaPorTrabajador.get(a.id_trabajador);
    if (!actual || (esCritica(a.prioridad) && !esCritica(actual.prioridad))) {
      alertaPorTrabajador.set(a.id_trabajador, a);
    }
  }

  if (trabajadores.length === 0) {
    workerList.innerHTML = '<li class="worker-item"><div class="worker-item__info"><span>Sin mediciones recientes</span></div></li>';
    return;
  }

  workerList.innerHTML = trabajadores.slice(0, 6).map((m) => {
    const nombre = nombreCompleto(m);
    const alerta = alertaPorTrabajador.get(m.id_trabajador);
    const badgeClase = alerta ? (esCritica(alerta.prioridad) ? 'badge--critical' : 'badge--warning') : 'badge--normal';
    const badgeTexto = alerta ? (alerta.tipo_alerta || 'Alerta') : 'Normal';

    return `<li class="worker-item">
      <div class="avatar avatar--sm">${escapeHtml(iniciales(nombre))}</div>
      <div class="worker-item__info">
        <strong>${escapeHtml(nombre)}</strong>
        <span>${escapeHtml(m.frecuencia_cardiaca ?? '--')} BPM</span>
      </div>
      <span class="badge ${badgeClase}">${escapeHtml(badgeTexto)}</span>
    </li>`;
  }).join('');
}

function renderAlertsChart(historico) {
  const canvas = document.getElementById('alertsChart');
  if (!canvas || !window.Chart) return;

  const dias = [];
  const conteoPorDia = {};
  for (let i = 6; i >= 0; i -= 1) {
    const fecha = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const clave = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    dias.push(clave);
    conteoPorDia[clave] = 0;
  }

  historico.forEach((a) => {
    const clave = new Date(a.fecha_hora).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    if (clave in conteoPorDia) conteoPorDia[clave] += 1;
  });

  alertsChart?.destroy();
  alertsChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: dias,
      datasets: [{
        data: dias.map((d) => conteoPorDia[d]),
        backgroundColor: '#f59e0b',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    },
  });
}

function renderHeartChart(medicionesHoy) {
  const canvas = document.getElementById('heartChart');
  if (!canvas || !window.Chart) return;

  const promedioPorHora = new Array(24).fill(null).map(() => ({ suma: 0, cantidad: 0 }));
  medicionesHoy.forEach((m) => {
    if (m.frecuencia_cardiaca == null) return;
    const hora = new Date(m.fecha_hora).getHours();
    promedioPorHora[hora].suma += Number(m.frecuencia_cardiaca);
    promedioPorHora[hora].cantidad += 1;
  });

  const horaActual = new Date().getHours();
  const horas = [];
  const promedios = [];
  for (let h = 0; h <= horaActual; h += 1) {
    horas.push(`${String(h).padStart(2, '0')}:00`);
    const bucket = promedioPorHora[h];
    promedios.push(bucket.cantidad > 0 ? Math.round(bucket.suma / bucket.cantidad) : null);
  }

  heartChart?.destroy();
  heartChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: horas,
      datasets: [{
        label: 'BPM promedio',
        data: promedios,
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45, 212, 191, 0.15)',
        fill: true,
        tension: 0.35,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    },
  });
}

async function cargarHome() {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [medicionesResult, alertasResult, historicoResult, hoyResult, dispositivosResult, medicionesHoyResult] = await Promise.allSettled([
    apiFetch('/dashboard/measurements/latest'),
    apiFetch('/alertas/activas'),
    apiFetch(`/alertas/historico?desde=${encodeURIComponent(hace7dias.toISOString())}`),
    apiFetch(`/alertas/historico?desde=${encodeURIComponent(inicioHoy.toISOString())}`),
    apiFetch('/dashboard/devices'),
    apiFetch(`/dashboard/measurements?desde=${encodeURIComponent(inicioHoy.toISOString())}&limit=1000`),
  ]);

  const trabajadores = medicionesResult.status === 'fulfilled' ? (medicionesResult.value?.data || []) : [];
  const alertasActivas = alertasResult.status === 'fulfilled' ? (alertasResult.value?.data || []) : [];
  const historico = historicoResult.status === 'fulfilled' ? (historicoResult.value?.data || []) : [];
  const alertasHoy = hoyResult.status === 'fulfilled' ? (hoyResult.value?.data || []) : [];
  const dispositivos = dispositivosResult.status === 'fulfilled' ? (dispositivosResult.value?.data || []) : [];
  const medicionesHoy = medicionesHoyResult.status === 'fulfilled' ? (medicionesHoyResult.value?.data || []) : [];

  renderKpis({ trabajadores, alertas: alertasActivas, riesgosHoy: alertasHoy, dispositivos });
  renderAlertList(alertasActivas);
  renderWorkerList(trabajadores, alertasActivas);
  renderAlertsChart(historico);
  renderHeartChart(medicionesHoy);

  [
    medicionesResult,
    alertasResult,
    historicoResult,
    hoyResult,
    dispositivosResult,
    medicionesHoyResult,
  ].forEach((result) => {
    if (result.status === 'rejected') {
      console.error(result.reason);
    }
  });
}

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-AR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

cargarHome().catch((error) => {
  console.error(error);
  const alertList = document.getElementById('alertList');
  if (alertList) {
    alertList.innerHTML = `<li class="alert-item"><div class="alert-item__info"><span>${escapeHtml(error.message)}</span></div></li>`;
  }
});

setInterval(() => cargarHome().catch((error) => console.error(error)), POLL_INTERVAL_MS);
