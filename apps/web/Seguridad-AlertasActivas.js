const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

// H0015: bandeja "en tiempo cercano al real" — polling simple (no hay
// WebSockets/SSE en el proyecto).
const POLL_INTERVAL_MS = 20000;

const tableBody = document.getElementById('alertTableBody');
const alertCount = document.getElementById('alertCount');
const filterTipo = document.getElementById('filterTipo');

let alertas = [];

const ETIQUETA_TIPO_ALERTA = {
  FATIGA: 'Fatiga',
  SOBREESFUERZO: 'Sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'Inactividad prolongada (wearable desconectado)',
};
const etiquetaTipo = (t) => ETIQUETA_TIPO_ALERTA[t] || t || 'Alerta';

function separarFechaHora(value) {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return { fecha: '--', hora: '--' };
  return {
    fecha: fecha.toLocaleDateString('es-AR'),
    hora: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
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
  const payload = await apiFetch('/alertas/activas');
  alertas = (payload.data || []).map((a) => ({
    id: a.id,
    prioridad: (a.prioridad || '').toLowerCase().includes('cr') ? 'critico' : 'advertencia',
    tipo: etiquetaTipo(a.tipo_alerta),
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    ...separarFechaHora(a.fecha_hora),
    estado: a.estado || 'Activa',
  }));
  actualizarContador();
  renderTabla();
}

function actualizarContador() {
  const total = alertas.length;
  alertCount.textContent = `${total} ${total === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
}

function renderTabla() {
  const filtro = filterTipo.value;
  const filtrados = filtro ? alertas.filter((a) => a.prioridad === filtro) : alertas;
  tableBody.innerHTML = filtrados.map((a) => `<tr>
      <td class="alert-td-prioridad"><span class="alert-badge-prioridad alert-badge-${a.prioridad}">${a.prioridad === 'critico' ? 'Crítico' : 'Advertencia'}</span></td>
      <td class="alert-td-tipo"><div class="alert-tipo alert-tipo--${a.prioridad}">${a.tipo}</div></td>
      <td class="alert-td-empleado">${a.empleado}</td>
      <td class="alert-td-fecha">${a.fecha}</td>
      <td class="alert-td-hora">${a.hora}</td>
      <td class="alert-td-estado"><span class="alert-badge-estado alert-badge-${a.estado}">${a.estado}</span></td>
      <td class="alert-td-acciones"><div class="alert-actions"><button class="alert-btn alert-btn--revisar" onclick="revisarAlerta(${a.id})">Revisar</button><button class="alert-btn alert-btn--cerrar" onclick="cerrarAlerta(${a.id})">Cerrar</button></div></td>
    </tr>`).join('');
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

filterTipo.addEventListener('change', renderTabla);

cargarAlertas().catch((error) => {
  console.error(error);
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px;">No se pudieron cargar las alertas activas</td></tr>';
});
setInterval(() => cargarAlertas().catch((error) => console.error(error)), POLL_INTERVAL_MS);
