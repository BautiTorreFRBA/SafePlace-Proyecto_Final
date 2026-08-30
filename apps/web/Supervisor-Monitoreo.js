const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

const tbody = document.getElementById('monTableBody');

// 3.5: Monitoreo y Home consumen el MISMO endpoint (/estado/trabajadores-activos)
// y el mismo diccionario de estados. El estado ya viene resuelto del backend:
// combina alerta activa (H0013) + capa base por umbral de FC (3.4) + frescura.
const ESTADO_CONFIG = {
  normal: { cls: 'badge--normal', label: '● Normal', bpm: 'bpm-value--normal' },
  advertencia: { cls: 'badge--warning', label: '● Advertencia', bpm: 'bpm-value--warning' },
  critico: { cls: 'badge--critical', label: '● Crítico', bpm: 'bpm-value--critical' },
  desactualizado: { cls: 'badge--neutral', label: '● Desactualizado', bpm: 'bpm-value--normal' },
  sin_datos: { cls: 'badge--neutral', label: '● Sin datos', bpm: 'bpm-value--normal' },
};

function configEstado(estado) {
  return ESTADO_CONFIG[estado] || ESTADO_CONFIG.normal;
}

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

async function cargarDatos() {
  const payload = await apiFetch('/estado/trabajadores-activos');
  const filas = (payload && payload.data) || [];

  const trabajadores = filas.map((r) => ({
    id: `ID-${r.id_trabajador}`,
    nombre: `${r.nombre || ''} ${r.apellido || ''}`.trim() || 'Sin nombre',
    bpm: r.frecuencia_cardiaca,
    actividad: MedHelpers.etiquetarActividad(r.actividad),
    tempValor: r.temperatura_corporal,
    spo2Valor: r.spo2,
    capTemp: MedHelpers.soporta(r.dispositivo_capacidades, 'temperatura'),
    capSpo2: MedHelpers.soporta(r.dispositivo_capacidades, 'spo2'),
    estado: r.estado_actual,
    descripcion: r.estado_descripcion || '',
    idDispositivo: r.id_dispositivo,
    fechaHora: r.fecha_hora,
    segundos: r.segundos_desde_ultima_lectura,
  }));

  renderTabla(trabajadores);
  actualizarKPIs(trabajadores);
  document.getElementById('lastUpdate').textContent = horaActual();
}

function celdaCapacidad(soporta, valor, sufijo) {
  // soporta: true (mostrar valor o "--"), false (no soportado), null (desconocido → como true).
  if (soporta === false) {
    return '<div class="mon-metric"><span style="color:var(--text-muted); font-size:0.8rem">no soportado</span></div>';
  }
  if (valor != null) {
    return `<div class="mon-metric">${valor}${sufijo}</div>`;
  }
  return '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';
}

function renderTabla(trabajadores) {
  // P4 / S4: ocultar Temp / SpO2 si NINGÚN wearable visible las soporta.
  const mostrarTemp = trabajadores.some((t) => t.capTemp !== false);
  const mostrarSpo2 = trabajadores.some((t) => t.capSpo2 !== false);
  const thTemp = document.getElementById('thTemp');
  const thSpo2 = document.getElementById('thSpo2');
  if (thTemp) thTemp.hidden = !mostrarTemp;
  if (thSpo2) thSpo2.hidden = !mostrarSpo2;

  const totalCols = 5 + (mostrarTemp ? 1 : 0) + (mostrarSpo2 ? 1 : 0);

  if (trabajadores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center; padding:32px; color:var(--text-muted);">Sin trabajadores monitoreados</td></tr>`;
    return;
  }

  tbody.innerHTML = trabajadores.map((t) => {
    const cfg = configEstado(t.estado);
    const bpmHTML = t.bpm != null
      ? `<div class="mon-metric"><span class="bpm-value ${cfg.bpm}">${t.bpm}</span>&nbsp;BPM</div>`
      : '<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>';

    const actTitle = t.actividad.estimado
      ? ' title="Estimado a partir de la variabilidad de la FC (ADR-14), no es una medición directa"'
      : '';
    const actHTML = `<span${actTitle}>${t.actividad.texto}${t.actividad.estimado ? ' <span style="color:var(--text-muted)">≈</span>' : ''}</span>`;

    const tempTd = mostrarTemp ? `<td>${celdaCapacidad(t.capTemp, t.tempValor, '°C')}</td>` : '';
    const spo2Td = mostrarSpo2 ? `<td>${celdaCapacidad(t.capSpo2, t.spo2Valor, '%')}</td>` : '';

    const stale = t.segundos != null && t.segundos > 300;
    const frescuraColor = stale ? 'var(--orange)' : 'var(--text-muted)';
    const horaHTML = `
      <div style="font-size:0.82rem">${MedHelpers.marcaTemporal(t.fechaHora)}</div>
      <div style="font-size:0.72rem; color:${frescuraColor}">${MedHelpers.formatearFrescura(t.segundos)}</div>`;

    const badgeTitle = t.descripcion ? ` title="${t.descripcion.replace(/"/g, '&quot;')}"` : '';

    return `<tr>
      <td><div class="mon-emp"><div class="avatar avatar--sm">${t.id}</div><span class="mon-emp__name">${t.nombre}</span></div></td>
      <td>${bpmHTML}</td>
      <td style="color:var(--text-secondary)">${actHTML}</td>
      ${tempTd}
      ${spo2Td}
      <td><span class="badge ${cfg.cls}"${badgeTitle}>${cfg.label}</span></td>
      <td style="color:var(--text-muted)">${horaHTML}</td>
    </tr>`;
  }).join('');
}

function actualizarKPIs(trabajadores) {
  const conAlerta = trabajadores.filter((t) => t.estado === 'advertencia' || t.estado === 'critico').length;
  const criticos = trabajadores.filter((t) => t.estado === 'critico').length;
  const conWearable = trabajadores.filter((t) => t.idDispositivo != null).length;
  const reportando = trabajadores.filter((t) => t.idDispositivo != null && t.segundos != null && t.segundos <= 300).length;

  document.getElementById('kpiTrabajadores').textContent = trabajadores.length;
  document.getElementById('kpiAlertas').textContent = conAlerta;
  document.getElementById('kpiCritico').textContent = criticos;
  document.getElementById('kpiDispositivos').textContent = `${reportando}/${conWearable}`;
  document.getElementById('notifBadge').textContent = conAlerta;
}

document.getElementById('btnActualizar').addEventListener('click', () => cargarDatos().catch((error) => alert(error.message)));
setInterval(() => cargarDatos().catch((error) => console.error(error)), 10_000);
cargarDatos().catch((error) => {
  console.error(error);
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">${error.message}</td></tr>`;
});
