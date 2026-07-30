const API_BASE_URL = window.__SAFEPLACE_API_URL__ || (window.location.port === '5173'
  ? 'http://localhost:8000/api/v1'
  : '/api/v1');

const tbody = document.getElementById('monTableBody');

const ESTADO_CONFIG = {
  normal: { cls: 'badge--normal', label: '● Normal' },
  warning: { cls: 'badge--warning', label: '● Advertencia' },
  critical: { cls: 'badge--critical', label: '● Crítico' },
};

const BPM_COLOR = {
  normal: 'bpm-value--normal',
  warning: 'bpm-value--warning',
  critical: 'bpm-value--critical',
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
    throw new Error(payload.error || payload.message || 'No se pudo completar la operación.');
  }

  return payload;
}

function horaActual() {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
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

// H0013: el estado real de un trabajador es si tiene una alerta activa y de
// qué prioridad — no `medicion.estado` (ninguna historia implementada hasta
// ahora llena esa columna, así que siempre da "Normal" si se usa esa).
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

async function cargarDatos() {
  const [medicionesPayload, activasPayload, dispositivosPayload] = await Promise.all([
    apiFetch('/dashboard/measurements?limit=200'),
    apiFetch('/alertas/activas'),
    apiFetch('/dashboard/devices'),
  ]);

  const mediciones = medicionMasRecientePorTrabajador(medicionesPayload.data || []);
  const activas = activasPayload.data || [];
  const alertaPorTrabajador = alertaActivaPorTrabajador(activas);
  const dispositivos = dispositivosPayload.data || [];

  const trabajadores = mediciones.map((m) => {
    const alerta = alertaPorTrabajador.get(m.id_trabajador);
    const estado = alerta ? (esCritica(alerta.prioridad) ? 'critical' : 'warning') : 'normal';

    return {
      id: `ID-${m.id_trabajador}`,
      nombre: `${m.operario_nombre || ''} ${m.operario_apellido || ''}`.trim() || 'Sin nombre',
      bpm: m.frecuencia_cardiaca,
      actividad: m.actividad || 'Sin actividad',
      temp: m.temperatura_corporal != null ? `${m.temperatura_corporal}°C` : null,
      spo2: m.spo2 != null ? `${m.spo2}%` : null,
      estado,
      hora: new Date(m.fecha_hora).toLocaleTimeString('es-AR'),
    };
  });

  renderTabla(trabajadores);
  actualizarKPIs(trabajadores, activas, dispositivos);
  document.getElementById('lastUpdate').textContent = horaActual();
}

function renderTabla(trabajadores) {
  if (trabajadores.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">Sin mediciones recientes</td></tr>';
    return;
  }

  tbody.innerHTML = trabajadores.map((t) => {
    const { cls, label } = ESTADO_CONFIG[t.estado];
    const bpmColor = BPM_COLOR[t.estado];
    const bpmHTML = t.bpm != null ? `<div class="mon-metric"><span class="bpm-value ${bpmColor}">${t.bpm}</span>&nbsp;BPM</div>` : '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';
    const tempHTML = t.temp != null ? `<div class="mon-metric">${t.temp}</div>` : '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';
    const spo2HTML = t.spo2 != null ? `<div class="mon-metric">${t.spo2}</div>` : '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';
    return `<tr><td><div class="mon-emp"><div class="avatar avatar--sm">${t.id}</div><span class="mon-emp__name">${t.nombre}</span></div></td><td>${bpmHTML}</td><td style="color:var(--text-secondary)">${t.actividad}</td><td>${tempHTML}</td><td>${spo2HTML}</td><td><span class="badge ${cls}">${label}</span></td><td style="color:var(--text-muted); font-size:0.82rem">${t.hora}</td></tr>`;
  }).join('');
}

function actualizarKPIs(trabajadores, activas, dispositivos) {
  const criticos = activas.filter((a) => esCritica(a.prioridad)).length;
  const conectados = dispositivos.filter((d) => d.ultimo_estado === 'CONECTADO').length;

  document.getElementById('kpiTrabajadores').textContent = trabajadores.length;
  document.getElementById('kpiAlertas').textContent = activas.length;
  document.getElementById('kpiCritico').textContent = criticos;
  document.getElementById('kpiDispositivos').textContent = `${conectados}/${dispositivos.length}`;
  document.getElementById('notifBadge').textContent = activas.length;
}

document.getElementById('btnActualizar').addEventListener('click', () => cargarDatos().catch((error) => alert(error.message)));
setInterval(() => cargarDatos().catch((error) => console.error(error)), 10_000);
cargarDatos().catch((error) => {
  console.error(error);
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">${error.message}</td></tr>`;
});
