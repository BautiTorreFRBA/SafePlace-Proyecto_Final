const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const tableBody = document.getElementById('simTableBody');
const count = document.getElementById('simCount');
const toggleButton = document.getElementById('btnToggleSim');
const statusDot = document.getElementById('simStatusDot');
const statusText = document.getElementById('simStatusText');
let simActiva = false;

function escapeHtml(value) {
  return String(value ?? '--').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; return null; }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudo obtener la información.');
  return payload;
}

function actualizarControlSimulacion() {
  toggleButton.disabled = false;
  toggleButton.textContent = simActiva ? 'Detener simulación' : 'Iniciar simulación';
  toggleButton.style.background = simActiva ? '#ef4444' : '';
  statusDot.className = `dot ${simActiva ? 'dot--green' : 'dot--gray'}`;
  statusText.textContent = simActiva ? 'Activa' : 'Inactiva';
}

function renderOperarios(operarios) {
  count.textContent = `${operarios.length} operario${operarios.length === 1 ? '' : 's'} incluido${operarios.length === 1 ? '' : 's'} en la simulación`;
  tableBody.innerHTML = operarios.length
    ? operarios.map((o) => `<tr><td><strong>${escapeHtml(o.nombre)}</strong></td><td>${escapeHtml(o.apellido)}</td><td class="emp-id">${escapeHtml(o.legajo)}</td><td>${escapeHtml(o.area)}</td><td>${escapeHtml(o.turno)}</td><td style="color:var(--text-secondary)">${escapeHtml([o.marca, o.modelo].filter(Boolean).join(' ') || 'Wearable')}<br><small>${escapeHtml(o.direccion_mac)}</small></td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No hay operarios con wearables de simulación asignados.</td></tr>';
}

async function cargar() {
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Cargando…</td></tr>';
  try {
    const [operarios, simulacion] = await Promise.all([apiFetch('/simulacion/operarios'), apiFetch('/simulacion')]);
    renderOperarios(operarios?.data || []);
    simActiva = Boolean(simulacion?.data?.activa);
    actualizarControlSimulacion();
  } catch (error) {
    count.textContent = 'No se pudo cargar la simulación';
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#fca5a5">${escapeHtml(error.message)}</td></tr>`;
    statusText.textContent = 'No disponible';
  }
}

document.getElementById('refreshBtn').addEventListener('click', cargar);
toggleButton.addEventListener('click', async () => {
  toggleButton.disabled = true;
  try {
    const response = await apiFetch('/simulacion', {
      method: 'PUT',
      body: JSON.stringify({ activa: !simActiva }),
    });
    simActiva = Boolean(response?.data?.activa ?? !simActiva);
    actualizarControlSimulacion();
  } catch (error) {
    alert(`Error al cambiar estado de simulación: ${error.message}`);
    actualizarControlSimulacion();
  }
});
cargar();
