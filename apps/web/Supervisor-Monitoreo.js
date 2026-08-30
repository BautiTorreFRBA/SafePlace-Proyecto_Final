const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

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

// /dashboard/measurements/latest ya devuelve una fila por trabajador (su
// medición más reciente, resuelto en la DB). Antes se pedía el log completo
// y se recortaba acá, pero si un operario concentra casi todas las lecturas
// tapaba al resto.

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
    apiFetch('/dashboard/measurements/latest'),
    apiFetch('/alertas/activas'),
    apiFetch('/dashboard/devices'),
  ]);

  const mediciones = medicionesPayload.data || [];
  const activas = activasPayload.data || [];
  const alertaPorTrabajador = alertaActivaPorTrabajador(activas);
  const dispositivos = dispositivosPayload.data || [];

  const trabajadores = mediciones.map((m) => {
    const alerta = alertaPorTrabajador.get(m.id_trabajador);
    const estado = alerta ? (esCritica(alerta.prioridad) ? 'critical' : 'warning') : 'normal';
    const caps = m.dispositivo_capacidades;

    return {
      id: `ID-${m.id_trabajador}`,
      nombre: `${m.operario_nombre || ''} ${m.operario_apellido || ''}`.trim() || 'Sin nombre',
      bpm: m.frecuencia_cardiaca,
      actividad: MedHelpers.etiquetarActividad(m.actividad),
      tempValor: m.temperatura_corporal,
      spo2Valor: m.spo2,
      capTemp: MedHelpers.soporta(caps, 'temperatura'),
      capSpo2: MedHelpers.soporta(caps, 'spo2'),
      estado,
      fechaHora: m.fecha_hora,
      segundos: MedHelpers.segundosDesde(m.fecha_hora),
    };
  });

  renderTabla(trabajadores);
  actualizarKPIs(trabajadores, activas, dispositivos);
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
    tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center; padding:32px; color:var(--text-muted);">Sin mediciones recientes</td></tr>`;
    return;
  }

  tbody.innerHTML = trabajadores.map((t) => {
    const { cls, label } = ESTADO_CONFIG[t.estado];
    const bpmColor = BPM_COLOR[t.estado];
    const bpmHTML = t.bpm != null
      ? `<div class="mon-metric"><span class="bpm-value ${bpmColor}">${t.bpm}</span>&nbsp;BPM</div>`
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

    return `<tr>
      <td><div class="mon-emp"><div class="avatar avatar--sm">${t.id}</div><span class="mon-emp__name">${t.nombre}</span></div></td>
      <td>${bpmHTML}</td>
      <td style="color:var(--text-secondary)">${actHTML}</td>
      ${tempTd}
      ${spo2Td}
      <td><span class="badge ${cls}">${label}</span></td>
      <td style="color:var(--text-muted)">${horaHTML}</td>
    </tr>`;
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
