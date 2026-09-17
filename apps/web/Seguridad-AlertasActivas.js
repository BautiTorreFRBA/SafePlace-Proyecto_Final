const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

// H0015: bandeja "en tiempo cercano al real" — polling simple (no hay
// WebSockets/SSE en el proyecto).
const POLL_INTERVAL_MS = 20000;

const tableBody = document.getElementById('alertTableBody');
const alertCount = document.getElementById('alertCount');
const filterSeveridad = document.getElementById('filterSeveridad');

let alertas = [];
let filtroEstado = 'pendientes';

const ETIQUETA_TIPO_ALERTA = {
  FATIGA: 'Fatiga',
  SOBREESFUERZO: 'Sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'Inactividad prolongada (wearable desconectado)',
};
const etiquetaTipo = (t) => ETIQUETA_TIPO_ALERTA[t] || t || 'Alerta';
const claseTipo = (t) => ({
  FATIGA: 'fatiga',
  SOBREESFUERZO: 'sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'inactividad',
}[String(t || '').toUpperCase()] || '');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizarAlerta(a) {
  const estado = a.estado || 'Activa';
  const estadoNormalizado = String(estado).toLowerCase();
  return {
    id: a.id,
    prioridad: (a.prioridad || '').toLowerCase().includes('cr') ? 'critico' : 'advertencia',
    tipo: etiquetaTipo(a.tipo_alerta),
    claseTipo: claseTipo(a.tipo_alerta),
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    ...separarFechaHora(a.fecha_hora),
    estado,
    estadoClase: estadoNormalizado.includes('cerr') || estadoNormalizado.includes('atend') || estadoNormalizado.includes('resuel')
      ? 'cerrada'
      : estadoNormalizado.includes('rev') ? 'enrevision' : 'activo',
  };
}

function separarFechaHora(value) {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return { fecha: '--', hora: '--' };
  return {
    fecha: fmtARFecha(fecha),
    hora: fmtARHora(fecha, { hour: '2-digit', minute: '2-digit' }),
  };
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

async function cargarAlertas() {
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);
  const [activas, historico] = await Promise.allSettled([
    apiFetch('/alertas/activas'),
    apiFetch(`/alertas/historico?desde=${encodeURIComponent(desde.toISOString())}`),
  ]);
  if (activas.status !== 'fulfilled' && historico.status !== 'fulfilled') throw activas.reason || historico.reason;

  const porId = new Map();
  (historico.status === 'fulfilled' ? historico.value?.data || [] : []).forEach((a) => porId.set(a.id, normalizarAlerta(a)));
  // La versión activa reemplaza a cualquier copia del historial.
  (activas.status === 'fulfilled' ? activas.value?.data || [] : []).forEach((a) => porId.set(a.id, normalizarAlerta(a)));
  alertas = [...porId.values()].sort((a, b) => {
    const prioridad = { critico: 0, advertencia: 1 };
    return prioridad[a.prioridad] - prioridad[b.prioridad];
  });
  actualizarContador();
  renderTabla();
}

function actualizarContador() {
  const total = alertas.filter((a) => a.estadoClase !== 'cerrada').length;
  alertCount.textContent = `${total} ${total === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
}

function renderTabla() {
  const severidad = filterSeveridad.value;
  const filtrados = alertas.filter((a) => {
    const coincideSeveridad = !severidad || a.prioridad === severidad;
    const esResuelta = a.estadoClase === 'cerrada';
    const coincideEstado = filtroEstado === 'todas' || (filtroEstado === 'resueltas' ? esResuelta : !esResuelta);
    return coincideSeveridad && coincideEstado;
  });
  tableBody.innerHTML = filtrados.length ? filtrados.map((a) => `<tr>
      <td class="alert-td-prioridad"><span class="alert-badge-prioridad alert-badge-${a.prioridad}">${a.prioridad === 'critico' ? 'Alta' : 'Media'}</span></td>
      <td class="alert-td-tipo"><div class="alert-tipo">${escapeHtml(a.tipo)}</div></td>
      <td class="alert-td-empleado">${escapeHtml(a.empleado)}</td>
      <td class="alert-td-fecha">${escapeHtml(a.fecha)}</td>
      <td class="alert-td-hora">${escapeHtml(a.hora)}</td>
      <td class="alert-td-estado"><span class="alert-badge-estado alert-badge-${a.estadoClase}">${escapeHtml(a.estado)}</span></td>
      <td class="alert-td-acciones">${a.estadoClase === 'cerrada' ? '<span class="alert-action-done">Resuelta</span>' : `<div class="alert-actions"><button class="alert-btn alert-btn--revisar" onclick="revisarAlerta(${a.id})">Revisar</button><button class="alert-btn alert-btn--cerrar" onclick="cerrarAlerta(${a.id})">Cerrar</button></div>`}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="alert-empty">No hay alertas para los filtros seleccionados.</td></tr>';
}

async function cambiarEstado(id, estado) {
  try {
    await apiFetch(`/alertas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    await cargarAlertas();
  } catch (error) {
    alert(error.message);
  }
}

window.revisarAlerta = (id) => cambiarEstado(id, 'Atendida');
window.cerrarAlerta = (id) => cambiarEstado(id, 'Cerrada');

filterSeveridad.addEventListener('change', renderTabla);
document.querySelectorAll('.alert-status-filter').forEach((button) => {
  button.addEventListener('click', () => {
    filtroEstado = button.dataset.filter;
    document.querySelectorAll('.alert-status-filter').forEach((item) => item.classList.toggle('is-active', item === button));
    renderTabla();
  });
});

cargarAlertas().catch((error) => {
  console.error(error);
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px;">No se pudieron cargar las alertas activas</td></tr>';
});
setInterval(() => cargarAlertas().catch((error) => console.error(error)), POLL_INTERVAL_MS);
