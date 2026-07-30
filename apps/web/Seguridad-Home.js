const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'http://localhost:8000/api/v1';

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
  return `${item.operario_nombre || ''} ${item.operario_apellido || ''}`.trim() || 'Sin asignar';
}

function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'SP';
  return partes.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function esCritica(prioridad) {
  const normalizada = String(prioridad || '').toLowerCase();
  return normalizada.includes('crít') || normalizada.includes('crit');
}

// Una lectura por trabajador (la más reciente): /dashboard/measurements trae
// el log completo (más reciente primero), acá se reduce a "estado actual".
function medicionMasRecientePorTrabajador(mediciones) {
  const porTrabajador = new Map();
  for (const m of mediciones) {
    if (m.id_trabajador == null) continue;
    if (!porTrabajador.has(m.id_trabajador)) {
      porTrabajador.set(m.id_trabajador, m);
    }
  }
  return [...porTrabajador.values()];
}

// H0013: el estado "real" de un trabajador en el panel es si tiene una
// alerta activa y de qué prioridad — no `medicion.estado` (ninguna historia
// implementada hasta ahora llena esa columna).
function alertaActivaPorTrabajador(alertasActivas) {
  const mapa = new Map();
  for (const a of alertasActivas) {
    if (a.id_trabajador == null) continue;
    const actual = mapa.get(a.id_trabajador);
    if (!actual || (esCritica(a.prioridad) && !esCritica(actual.prioridad))) {
      mapa.set(a.id_trabajador, a);
    }
  }
  return mapa;
}

function renderKpis({ mediciones, activas, riesgosHoy, dispositivos }) {
  const trabajadoresActivos = new Set(mediciones.map((m) => m.id_trabajador).filter((id) => id != null));
  document.getElementById('kpiTrabajadores').textContent = trabajadoresActivos.size;
  document.getElementById('kpiAlertas').textContent = activas.length;
  document.getElementById('kpiRiesgos').textContent = riesgosHoy.length;

  const conectados = dispositivos.filter((d) => d.ultimo_estado === 'CONECTADO').length;
  document.getElementById('kpiDispositivos').textContent = `${conectados}/${dispositivos.length}`;

  document.getElementById('alertasBadge').textContent = `${activas.length} ${activas.length === 1 ? 'alerta' : 'alertas'}`;
}

function renderAlertList(activas) {
  const alertList = document.getElementById('alertList');

  if (activas.length === 0) {
    alertList.innerHTML = '<li class="alert-item"><div class="alert-item__info"><span>No hay alertas activas</span></div></li>';
    return;
  }

  alertList.innerHTML = activas.slice(0, 6).map((a) => {
    const critica = esCritica(a.prioridad);
    return `<li class="alert-item">
      <span class="dot ${critica ? 'dot--red' : 'dot--orange'}"></span>
      <div class="alert-item__info">
        <strong>${escapeHtml(nombreCompleto(a))}</strong>
        <span>${escapeHtml(a.tipo_alerta)}</span>
      </div>
      <span class="badge ${critica ? 'badge--critical' : 'badge--warning'}">${escapeHtml(a.prioridad)}</span>
    </li>`;
  }).join('');
}

function renderWorkerList(mediciones, alertaPorTrabajador) {
  const workerList = document.getElementById('workerList');
  const recientes = medicionMasRecientePorTrabajador(mediciones);

  if (recientes.length === 0) {
    workerList.innerHTML = '<li class="worker-item"><div class="worker-item__info"><span>Sin mediciones recientes</span></div></li>';
    return;
  }

  workerList.innerHTML = recientes.slice(0, 6).map((m) => {
    const nombre = nombreCompleto(m);
    const alerta = alertaPorTrabajador.get(m.id_trabajador);
    const badgeClase = alerta ? (esCritica(alerta.prioridad) ? 'badge--critical' : 'badge--warning') : 'badge--normal';
    const badgeTexto = alerta ? alerta.tipo_alerta : 'Normal';

    return `<li class="worker-item">
      <div class="avatar avatar--sm">${escapeHtml(iniciales(nombre))}</div>
      <div class="worker-item__info">
        <strong>${escapeHtml(nombre)}</strong>
        <span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${m.frecuencia_cardiaca ?? '--'} BPM</span>
      </div>
      <span class="badge ${badgeClase}">${escapeHtml(badgeTexto)}</span>
    </li>`;
  }).join('');
}

let alertsChart;
let heartChart;

function renderAlertsChart(historico) {
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
  alertsChart = new Chart(document.getElementById('alertsChart'), {
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
  heartChart = new Chart(document.getElementById('heartChart'), {
    type: 'line',
    data: {
      labels: horas,
      datasets: [{
        data: promedios,
        borderColor: '#f87171',
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
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

async function cargarDashboard() {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [medicionesPayload, activasPayload, historicoPayload, hoyAlertasPayload, medicionesHoyPayload, dispositivosPayload] = await Promise.all([
    apiFetch('/dashboard/measurements?limit=200'),
    apiFetch('/alertas/activas'),
    apiFetch(`/alertas/historico?desde=${encodeURIComponent(hace7dias.toISOString())}`),
    apiFetch(`/alertas/historico?desde=${encodeURIComponent(inicioHoy.toISOString())}`),
    apiFetch(`/dashboard/measurements?desde=${encodeURIComponent(inicioHoy.toISOString())}&limit=1000`),
    apiFetch('/dashboard/devices'),
  ]);

  const mediciones = medicionesPayload.data || [];
  const activas = activasPayload.data || [];
  const alertaPorTrabajador = alertaActivaPorTrabajador(activas);

  renderKpis({
    mediciones,
    activas,
    riesgosHoy: hoyAlertasPayload.data || [],
    dispositivos: dispositivosPayload.data || [],
  });
  renderAlertList(activas);
  renderWorkerList(mediciones, alertaPorTrabajador);
  renderAlertsChart(historicoPayload.data || []);
  renderHeartChart(medicionesHoyPayload.data || []);
}

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-AR', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

cargarDashboard().catch((error) => {
  console.error(error);
  document.getElementById('alertList').innerHTML = `<li class="alert-item"><div class="alert-item__info"><span>${escapeHtml(error.message)}</span></div></li>`;
});
setInterval(() => cargarDashboard().catch((error) => console.error(error)), 30000);
