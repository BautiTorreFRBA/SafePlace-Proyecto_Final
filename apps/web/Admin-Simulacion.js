const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const tableBody = document.getElementById('simTableBody');
const count = document.getElementById('simCount');
const status = document.getElementById('simStatus');

function escapeHtml(value) {
  return String(value ?? '--').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function apiFetch(path) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; return null; }
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudo obtener la información.');
  return payload;
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
    const activa = Boolean(simulacion?.data?.activa);
    status.innerHTML = `<span class="dot ${activa ? 'dot--green' : 'dot--gray'}"></span><span>${activa ? 'Simulación activa' : 'Simulación inactiva'}</span>`;
  } catch (error) {
    count.textContent = 'No se pudo cargar la simulación';
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#fca5a5">${escapeHtml(error.message)}</td></tr>`;
  }
}

document.getElementById('refreshBtn').addEventListener('click', cargar);
cargar();
