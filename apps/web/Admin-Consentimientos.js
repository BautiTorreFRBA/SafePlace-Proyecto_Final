const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

const trabajadorSelect = document.getElementById('trabajadorSelect');
const versionPoliticaInput = document.getElementById('versionPoliticaInput');
const btnOtorgar = document.getElementById('btnOtorgar');
const btnRevocar = document.getElementById('btnRevocar');
const tableBody = document.getElementById('historialTableBody');
const consentimientoEstado = document.getElementById('consentimientoEstado');
const estadoBadge = document.getElementById('estadoBadge');
const ultimaOperacion = document.getElementById('ultimaOperacion');

let trabajadores = [];
let historial = [];

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

function nombreTrabajador(trabajador) {
  return `${trabajador.nombre || ''} ${trabajador.apellido || ''}`.trim() || `Trabajador ${trabajador.id}`;
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

function renderTrabajadores() {
  trabajadorSelect.innerHTML = trabajadores.length === 0
    ? '<option value="">No hay trabajadores activos</option>'
    : '<option value="">Seleccionar trabajador...</option>'
      + trabajadores.map((trabajador) => `<option value="${trabajador.id}">${escapeHtml(nombreTrabajador(trabajador))} - ${escapeHtml(trabajador.legajo || `ID-${trabajador.id}`)}</option>`).join('');
}

function renderEstado() {
  if (!trabajadorSelect.value) {
    consentimientoEstado.textContent = 'Estado vigente: Sin registro';
    estadoBadge.className = 'badge badge--neutral';
    estadoBadge.textContent = 'Sin registro';
    return;
  }

  if (historial.length === 0) {
    consentimientoEstado.textContent = 'Estado vigente: Sin registro';
    estadoBadge.className = 'badge badge--neutral';
    estadoBadge.textContent = 'Sin registro';
    return;
  }

  const vigente = historial[0];
  const otorgado = Boolean(vigente.estado);
  consentimientoEstado.textContent = `Estado vigente: ${otorgado ? 'Otorgado' : 'Revocado'} desde ${formatDate(vigente.fecha_hora)}`;
  estadoBadge.className = `badge ${otorgado ? 'badge--normal' : 'badge--neutral'}`;
  estadoBadge.textContent = otorgado ? 'Otorgado' : 'Revocado';
}

function rowHTML(item) {
  const otorgado = Boolean(item.estado);
  const estado = otorgado
    ? '<span class="badge badge--normal">Otorgado</span>'
    : '<span class="badge badge--neutral">Revocado</span>';

  return `<tr>
      <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(formatDate(item.fecha_hora))}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(item.version_politica || '--')}</td>
      <td>${estado}</td>
    </tr>`;
}

function renderHistorial() {
  renderEstado();

  tableBody.innerHTML = historial.length === 0
    ? '<tr><td colspan="3" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No hay registros de consentimiento para el trabajador seleccionado</td></tr>'
    : historial.map((item) => rowHTML(item)).join('');
}

async function cargarTrabajadores() {
  const payload = await apiFetch('/trabajadores');
  trabajadores = payload.data || [];
  renderTrabajadores();
}

async function cargarHistorial() {
  const idTrabajador = trabajadorSelect.value;
  historial = [];

  if (!idTrabajador) {
    ultimaOperacion.textContent = 'Seleccioná un trabajador para consultar su historial';
    renderHistorial();
    return;
  }

  const payload = await apiFetch(`/consentimientos/${idTrabajador}`);
  historial = payload.data || [];
  ultimaOperacion.textContent = `${historial.length} registro${historial.length === 1 ? '' : 's'} en el historial`;
  renderHistorial();
}

async function otorgarConsentimiento() {
  const idTrabajador = Number(trabajadorSelect.value);
  const versionPolitica = versionPoliticaInput.value.trim();

  if (!idTrabajador || !versionPolitica) {
    alert('Seleccioná un trabajador e ingresá la versión de política.');
    return;
  }

  try {
    btnOtorgar.disabled = true;
    const payload = await apiFetch('/consentimientos', {
      method: 'POST',
      body: JSON.stringify({ idTrabajador, versionPolitica }),
    });

    const data = payload.data || {};
    versionPoliticaInput.value = '';
    await cargarHistorial();
    ultimaOperacion.textContent = `Otorgamiento registrado el ${formatDate(data.fecha_hora)}`;
  } catch (error) {
    alert(error.message);
  } finally {
    btnOtorgar.disabled = false;
  }
}

async function revocarConsentimiento() {
  const idTrabajador = Number(trabajadorSelect.value);

  if (!idTrabajador) {
    alert('Seleccioná un trabajador.');
    return;
  }

  try {
    btnRevocar.disabled = true;
    const payload = await apiFetch(`/consentimientos/${idTrabajador}/revocar`, { method: 'POST' });
    const data = payload.data || {};
    await cargarHistorial();
    ultimaOperacion.textContent = `Revocación registrada el ${formatDate(data.fecha_hora)}`;
  } catch (error) {
    alert(error.message);
  } finally {
    btnRevocar.disabled = false;
  }
}

trabajadorSelect.addEventListener('change', () => {
  cargarHistorial().catch((error) => {
    alert(error.message);
  });
});

btnOtorgar.addEventListener('click', otorgarConsentimiento);
btnRevocar.addEventListener('click', revocarConsentimiento);
versionPoliticaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    otorgarConsentimiento();
  }
});

renderHistorial();
cargarTrabajadores().catch((err) => {
  console.error(err);
  trabajadorSelect.innerHTML = '<option value="">Error cargando trabajadores</option>';
  tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se pudieron cargar los datos de consentimiento</td></tr>';
});
