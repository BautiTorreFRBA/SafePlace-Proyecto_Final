const API_BASE_URL = 'http://localhost:8000/api/v1';
const tbody = document.getElementById('monTableBody');

const ESTADO_CONFIG = {
  normal: { cls: 'badge--normal', label: '● Normal' },
  warning: { cls: 'badge--warning', label: '● Advertencia' },
  critical: { cls: 'badge--critical', label: '● Crítico' },
  disconnected: { cls: 'badge--disconnected', label: '● Desconectado' },
};

const BPM_COLOR = {
  normal: 'bpm-value--normal',
  warning: 'bpm-value--warning',
  critical: 'bpm-value--critical',
  disconnected: 'bpm-value--normal',
};

function horaActual() {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

async function cargarDatos() {
  const res = await fetch(`${API_BASE_URL}/dashboard/measurements?limit=50`);
  const json = await res.json();
  const trabajadores = (json.data || []).map((m) => ({
    id: `ID-${m.id_trabajador}`,
    nombre: `${m.operario_nombre || ''} ${m.operario_apellido || ''}`.trim() || 'Sin nombre',
    bpm: m.frecuencia_cardiaca,
    actividad: m.actividad || 'Sin actividad',
    temp: m.temperatura_corporal != null ? `${m.temperatura_corporal}°C` : null,
    spo2: m.spo2 != null ? `${m.spo2}%` : null,
    estado: m.estado === 'critical' ? 'critical' : m.estado === 'warning' ? 'warning' : 'normal',
    hora: new Date(m.fecha_hora).toLocaleTimeString('es-AR'),
  }));
  renderTabla(trabajadores);
  actualizarKPIs(trabajadores);
  document.getElementById('lastUpdate').textContent = horaActual();
}

function renderTabla(trabajadores) {
  tbody.innerHTML = trabajadores.map((t) => {
    const { cls, label } = ESTADO_CONFIG[t.estado];
    const bpmColor = BPM_COLOR[t.estado];
    const bpmHTML = t.bpm != null ? `<div class="mon-metric"><span class="bpm-value ${bpmColor}">${t.bpm}</span>&nbsp;BPM</div>` : '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';
    const tempHTML = t.temp != null ? `<div class="mon-metric">${t.temp}</div>` : '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';
    const spo2HTML = t.spo2 != null ? `<div class="mon-metric">${t.spo2}</div>` : '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';
    return `<tr><td><div class="mon-emp"><div class="avatar avatar--sm">${t.id}</div><span class="mon-emp__name">${t.nombre}</span></div></td><td>${bpmHTML}</td><td style="color:var(--text-secondary)">${t.actividad}</td><td>${tempHTML}</td><td>${spo2HTML}</td><td><span class="badge ${cls}">${label}</span></td><td style="color:var(--text-muted); font-size:0.82rem">${t.hora}</td></tr>`;
  }).join('');
}

function actualizarKPIs(trabajadores) {
  const alertas = trabajadores.filter((t) => t.estado === 'warning' || t.estado === 'critical').length;
  const criticos = trabajadores.filter((t) => t.estado === 'critical').length;
  const total = trabajadores.length;
  document.getElementById('kpiTrabajadores').textContent = total;
  document.getElementById('kpiAlertas').textContent = alertas;
  document.getElementById('kpiCritico').textContent = criticos;
  document.getElementById('kpiDispositivos').textContent = `${total}/${total}`;
  document.getElementById('notifBadge').textContent = alertas;
}

document.getElementById('btnActualizar').addEventListener('click', () => cargarDatos().catch(console.error));
setInterval(() => cargarDatos().catch(console.error), 10_000);
cargarDatos().catch(console.error);
