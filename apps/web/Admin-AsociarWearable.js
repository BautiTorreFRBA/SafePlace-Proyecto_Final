const API_BASE_URL = window.__SAFEPLACE_API_URL__ || (window.location.port === '5173'
  ? 'http://localhost:8000/api/v1'
  : '/api/v1');

const trabajadorSelect = document.getElementById('trabajadorSelect');
const wearableSelect = document.getElementById('wearableSelect');
const btnAsociar = document.getElementById('btnAsociar');
const tableBody = document.getElementById('asocTableBody');
const asocCount = document.getElementById('asocCount');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalSave = document.getElementById('modalSave');
const fechaHastaInput = document.getElementById('fechaHastaInput');

let trabajadores = [];
let wearables = [];
let asociaciones = [];
let editingId = null;

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

function descripcionWearable(wearable) {
  const marcaModelo = `${wearable.marca || ''} ${wearable.modelo || ''}`.trim();
  return marcaModelo || `Wearable ${wearable.id}`;
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

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function renderSelects() {
  trabajadorSelect.innerHTML = trabajadores.length === 0
    ? '<option value="">No hay trabajadores activos</option>'
    : '<option value="">Seleccionar trabajador...</option>'
      + trabajadores.map((trabajador) => `<option value="${trabajador.id}">${escapeHtml(nombreTrabajador(trabajador))} - ${escapeHtml(trabajador.legajo || `ID-${trabajador.id}`)}</option>`).join('');

  wearableSelect.innerHTML = wearables.length === 0
    ? '<option value="">No hay wearables disponibles</option>'
    : '<option value="">Seleccionar wearable...</option>'
      + wearables.map((wearable) => `<option value="${wearable.id}">${escapeHtml(descripcionWearable(wearable))} - ID ${escapeHtml(wearable.id)}</option>`).join('');
}

async function cargarOpciones() {
  const [trabajadoresJson, wearablesJson] = await Promise.all([
    apiFetch('/trabajadores'),
    apiFetch('/wearables'),
  ]);

  trabajadores = trabajadoresJson.data || [];
  wearables = wearablesJson.data || [];
  renderSelects();
}

function renderTable() {
  const activas = asociaciones.filter((asoc) => !asoc.finalizada);
  asocCount.textContent = `${activas.length} asociaci${activas.length === 1 ? 'ón activa' : 'ones activas'} en esta sesión`;

  tableBody.innerHTML = asociaciones.length === 0
    ? '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No hay asociaciones creadas en esta sesión</td></tr>'
    : asociaciones.map((asoc) => rowHTML(asoc)).join('');
}

function rowHTML(asoc) {
  const estadoBadge = asoc.finalizada
    ? '<span class="badge badge--neutral">Finalizada</span>'
    : '<span class="badge badge--normal">Vigente</span>';
  const acciones = asoc.finalizada
    ? '<span style="color:var(--text-muted); font-size:0.82rem;">Sin acciones</span>'
    : `<div class="emp-actions">
        <button class="emp-actions__edit" data-action="modificar" data-id="${asoc.id}">Modificar fecha</button>
        <button class="emp-actions__deactivate" data-action="finalizar" data-id="${asoc.id}">Finalizar</button>
      </div>`;

  return `<tr>
      <td><div class="emp-name"><div class="avatar avatar--sm">${escapeHtml(asoc.iniciales)}</div><span class="emp-name__text">${escapeHtml(asoc.trabajadorNombre)}</span></div></td>
      <td class="emp-id">${escapeHtml(asoc.legajo)}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(asoc.wearableNombre)}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(formatDate(asoc.fechaDesde))}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(formatDate(asoc.fechaHasta))}</td>
      <td>${estadoBadge}</td>
      <td>${acciones}</td>
    </tr>`;
}

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function normalizarAsociacion(payload, trabajador, wearable) {
  const data = payload.data || {};
  const trabajadorNombre = nombreTrabajador(trabajador);
  return {
    id: data.id,
    idTrabajador: data.id_trabajador,
    idDispositivo: data.id_dispositivo,
    trabajadorNombre,
    iniciales: iniciales(trabajadorNombre || trabajador.legajo || ''),
    legajo: trabajador.legajo || `ID-${trabajador.id}`,
    wearableNombre: descripcionWearable(wearable),
    fechaDesde: data.fecha_desde,
    fechaHasta: data.fecha_hasta,
    finalizada: Boolean(data.fecha_hasta && new Date(data.fecha_hasta) <= new Date()),
  };
}

async function asociarWearable() {
  const idTrabajador = Number(trabajadorSelect.value);
  const idDispositivo = Number(wearableSelect.value);

  if (!idTrabajador || !idDispositivo) {
    alert('Seleccioná un trabajador y un wearable disponible.');
    return;
  }

  const trabajador = trabajadores.find((item) => Number(item.id) === idTrabajador);
  const wearable = wearables.find((item) => Number(item.id) === idDispositivo);

  try {
    btnAsociar.disabled = true;
    const payload = await apiFetch('/asociaciones', {
      method: 'POST',
      body: JSON.stringify({ idTrabajador, idDispositivo }),
    });

    asociaciones.unshift(normalizarAsociacion(payload, trabajador, wearable));
    renderTable();
    await cargarOpciones();
  } catch (error) {
    alert(error.message);
  } finally {
    btnAsociar.disabled = false;
  }
}

function openModal(id) {
  const asociacion = asociaciones.find((item) => String(item.id) === String(id));
  if (!asociacion || asociacion.finalizada) return;

  editingId = asociacion.id;
  fechaHastaInput.value = toDatetimeLocal(asociacion.fechaHasta);
  modalOverlay.classList.add('modal-overlay--visible');
  fechaHastaInput.focus();
}

function closeModal() {
  modalOverlay.classList.remove('modal-overlay--visible');
  editingId = null;
  fechaHastaInput.value = '';
}

async function modificarFecha() {
  if (!editingId) return;

  const fechaHasta = fechaHastaInput.value
    ? new Date(fechaHastaInput.value).toISOString()
    : null;

  try {
    const payload = await apiFetch(`/asociaciones/${editingId}`, {
      method: 'PUT',
      body: JSON.stringify(fechaHasta ? { fechaHasta } : {}),
    });

    const data = payload.data || {};
    asociaciones = asociaciones.map((asoc) => String(asoc.id) === String(editingId)
      ? {
        ...asoc,
        fechaHasta: data.fecha_hasta,
        finalizada: Boolean(data.fecha_hasta && new Date(data.fecha_hasta) <= new Date()),
      }
      : asoc);
    closeModal();
    renderTable();
    await cargarOpciones();
  } catch (error) {
    alert(error.message);
  }
}

async function finalizarAsociacion(id) {
  try {
    const payload = await apiFetch(`/asociaciones/${id}`, { method: 'PATCH' });
    const data = payload.data || {};
    asociaciones = asociaciones.map((asoc) => String(asoc.id) === String(id)
      ? { ...asoc, fechaHasta: data.fecha_hasta || new Date().toISOString(), finalizada: true }
      : asoc);
    renderTable();
    await cargarOpciones();
  } catch (error) {
    alert(error.message);
  }
}

tableBody.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;

  if (button.dataset.action === 'modificar') {
    openModal(button.dataset.id);
    return;
  }

  if (button.dataset.action === 'finalizar') {
    finalizarAsociacion(button.dataset.id);
  }
});

btnAsociar.addEventListener('click', asociarWearable);
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
modalSave.addEventListener('click', modificarFecha);
fechaHastaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    modificarFecha();
  }
});

renderTable();
cargarOpciones().catch((err) => {
  console.error(err);
  trabajadorSelect.innerHTML = '<option value="">Error cargando trabajadores</option>';
  wearableSelect.innerHTML = '<option value="">Error cargando wearables</option>';
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se pudieron cargar los datos para asociar wearables</td></tr>';
});
