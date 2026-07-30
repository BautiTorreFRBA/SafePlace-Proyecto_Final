const API_BASE_URL = window.__SAFEPLACE_API_URL__ || (window.location.port === '5173'
  ? 'http://localhost:8000/api/v1'
  : '/api/v1');

const tableBody = document.getElementById('estadoDispositivosTableBody');
const estadoDispositivosCount = document.getElementById('estadoDispositivosCount');

let dispositivos = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function descripcionDispositivo(dispositivo) {
  const marcaModelo = `${dispositivo.marca || ''} ${dispositivo.modelo || ''}`.trim();
  return marcaModelo || `Dispositivo ${dispositivo.id}`;
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function estadoBadge(estadoConexion) {
  if (estadoConexion === 'CONECTADO') {
    return '<span class="badge badge--normal">Conectado</span>';
  }

  if (estadoConexion === 'ERROR_CONEXION') {
    return '<span class="badge badge--critical">Error de conexi&oacute;n</span>';
  }

  if (estadoConexion === 'DESCONECTADO') {
    return '<span class="badge badge--neutral">Desconectado</span>';
  }

  return '<span class="badge badge--neutral">Sin datos</span>';
}

function rowHTML(dispositivo) {
  return `<tr>
      <td>
        <div class="emp-name">
          <div class="avatar avatar--sm">${escapeHtml(String(dispositivo.marca || 'SP').slice(0, 2).toUpperCase())}</div>
          <span class="emp-name__text">${escapeHtml(descripcionDispositivo(dispositivo))}</span>
        </div>
      </td>
      <td>
        <div class="emp-actions" style="gap:10px;">
          <input class="modal__input" data-mac-input="${dispositivo.id}" type="text" placeholder="AA:BB:CC:DD:EE:FF" value="${escapeHtml(dispositivo.direccion_mac || '')}" style="min-width:180px;" />
          <button class="modal__btn modal__btn--save" data-action="guardar-mac" data-id="${dispositivo.id}" style="padding:10px 14px;">Guardar</button>
        </div>
      </td>
      <td>${estadoBadge(dispositivo.estado_conexion)}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(formatDate(dispositivo.ultima_actividad))}</td>
    </tr>`;
}

function renderTable() {
  const conectados = dispositivos.filter((item) => item.estado_conexion === 'CONECTADO').length;
  estadoDispositivosCount.textContent = `${conectados} conectado${conectados === 1 ? '' : 's'} de ${dispositivos.length} dispositivo${dispositivos.length === 1 ? '' : 's'}`;

  tableBody.innerHTML = dispositivos.length === 0
    ? '<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No hay dispositivos registrados</td></tr>'
    : dispositivos.map((dispositivo) => rowHTML(dispositivo)).join('');
}

async function cargarDispositivos() {
  const payload = await apiFetch('/dispositivos/estado-conexion');
  dispositivos = payload.data || [];
  renderTable();
}

async function guardarMac(id, button) {
  const input = tableBody.querySelector(`[data-mac-input="${String(id)}"]`);
  const direccionMac = input ? input.value.trim() : '';

  if (!direccionMac) {
    alert('Ingresa la direccion MAC BLE.');
    return;
  }

  try {
    button.disabled = true;
    await apiFetch(`/wearables/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ direccionMac }),
    });
    await cargarDispositivos();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

tableBody.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-action="guardar-mac"]');
  if (!button) return;
  guardarMac(button.dataset.id, button);
});

tableBody.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target.closest('input[data-mac-input]');
  if (!input) return;
  const button = tableBody.querySelector(`button[data-id="${String(input.dataset.macInput)}"]`);
  if (button) {
    guardarMac(input.dataset.macInput, button);
  }
});

tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">Cargando dispositivos...</td></tr>';
cargarDispositivos().catch((err) => {
  console.error(err);
  estadoDispositivosCount.textContent = 'No se pudieron cargar los dispositivos';
  tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se pudieron cargar los estados de conexi&oacute;n</td></tr>';
});
