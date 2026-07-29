const API_BASE_URL = window.__SAFEPLACE_API_URL__ || (window.location.port === '5173'
  ? 'http://localhost:8000/api/v1'
  : '/api/v1');

const tableBody = document.getElementById('empTableBody');
const empCount = document.getElementById('empCount');
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalSave = document.getElementById('modalSave');
const btnNuevo = document.getElementById('btnNuevo');
const mNombre = document.getElementById('mNombre');
const mApellido = document.getElementById('mApellido');
const mLegajo = document.getElementById('mLegajo');
const mDept = document.getElementById('mDept');
const EMPLOYEES_ENDPOINT = '/dashboard/employees';

let empleados = [];
let editingId = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const iniciales = (nombre = '') => nombre
  .split(' ')
  .filter(Boolean)
  .map((w) => w[0])
  .slice(0, 2)
  .join('')
  .toUpperCase();

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
    throw new Error(payload.error || payload.message || 'No se pudo completar la operaci�n.');
  }

  return payload;
}

function normalizarEmpleado(emp) {
  const nombreCompleto = `${emp.nombre || ''} ${emp.apellido || ''}`.trim();
  return {
    id: emp.id,
    legajo: emp.legajo || `ID-${String(emp.id).padStart(3, '0')}`,
    nombre: emp.nombre || '',
    apellido: emp.apellido || '',
    nombreCompleto: nombreCompleto || 'Sin nombre',
    iniciales: iniciales(nombreCompleto || emp.legajo || ''),
    depto: emp.depto || emp.area || 'Sin asignar',
    rol: emp.rol || 'Operario',
    estado: emp.activo ? 'activo' : 'inactivo',
    alta: emp.alta ? new Date(emp.alta).toLocaleDateString('es-AR') : '--',
  };
}

async function cargarEmpleados() {
  const json = await apiFetch(EMPLOYEES_ENDPOINT);
  empleados = (json.data || []).map(normalizarEmpleado);
  renderTable();
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const estado = filterStatus.value;

  const filtrados = empleados.filter((emp) => {
    const matchBusqueda = !query
      || emp.nombreCompleto.toLowerCase().includes(query)
      || emp.legajo.toLowerCase().includes(query)
      || String(emp.id).toLowerCase().includes(query);
    const matchEstado = estado === 'todos' || emp.estado === estado;
    return matchBusqueda && matchEstado;
  });

  empCount.textContent = `${filtrados.length} empleado${filtrados.length !== 1 ? 's' : ''} registrado${filtrados.length !== 1 ? 's' : ''}`;

  tableBody.innerHTML = filtrados.length === 0
    ? '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se encontraron empleados</td></tr>'
    : filtrados.map((emp) => rowHTML(emp)).join('');
}

function rowHTML(emp) {
  const esActivo = emp.estado === 'activo';
  const estadoBadge = esActivo
    ? '<span class="badge badge--normal">? Activo</span>'
    : '<span class="badge badge--neutral">? Inactivo</span>';

  return `<tr>
      <td class="emp-id">${escapeHtml(emp.legajo)}</td>
      <td><div class="emp-name"><div class="avatar avatar--sm">${escapeHtml(emp.iniciales)}</div><span class="emp-name__text">${escapeHtml(emp.nombreCompleto)}</span></div></td>
      <td style="color:var(--text-secondary)">${escapeHtml(emp.depto)}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(emp.rol)}</td>
      <td>${estadoBadge}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(emp.alta)}</td>
      <td><div class="emp-actions"><button class="emp-actions__edit" data-id="${emp.id}">Editar</button></div></td>
    </tr>`;
}

function openModal(modo, id = null) {
  editingId = id;
  if (modo === 'editar') {
    const emp = empleados.find((e) => String(e.id) === String(id));
    if (!emp) return;
    modalTitle.textContent = 'Editar Empleado';
    mNombre.value = emp.nombre || '';
    mApellido.value = emp.apellido || '';
    mLegajo.value = emp.legajo || '';
    mDept.value = emp.depto || '';
  } else {
    modalTitle.textContent = 'Nuevo Empleado';
    mNombre.value = '';
    mApellido.value = '';
    mLegajo.value = '';
    mDept.value = '';
  }
  modalOverlay.classList.add('modal-overlay--visible');
  mNombre.focus();
}

function closeModal() {
  modalOverlay.classList.remove('modal-overlay--visible');
  editingId = null;
}

function limpiarCampos() {
  mNombre.value = '';
  mApellido.value = '';
  mLegajo.value = '';
  mDept.value = '';
}

async function guardarEmpleado() {
  const nombre = mNombre.value.trim();
  const apellido = mApellido.value.trim();
  const legajo = mLegajo.value.trim();
  const area = mDept.value.trim();

  if (!nombre || !apellido || !legajo || !area) {
    alert('Complet� nombre, apellido, legajo y departamento.');
    return;
  }

  try {
    await apiFetch(editingId ? `${EMPLOYEES_ENDPOINT}/${editingId}` : EMPLOYEES_ENDPOINT, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify({ nombre, apellido, legajo, area }),
    });
    closeModal();
    limpiarCampos();
    await cargarEmpleados();
  } catch (error) {
    alert(error.message);
  }
}

tableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.emp-actions__edit');
  if (editBtn) {
    return openModal('editar', editBtn.dataset.id);
  }
});

searchInput.addEventListener('input', renderTable);
filterStatus.addEventListener('change', renderTable);
btnNuevo.addEventListener('click', () => openModal('crear'));
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
modalSave.addEventListener('click', guardarEmpleado);
[mNombre, mApellido, mLegajo, mDept].forEach((campo) => campo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    guardarEmpleado();
  }
}));

cargarEmpleados().catch((err) => {
  console.error(err);
  empCount.textContent = 'Error cargando empleados';
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se pudieron cargar los empleados</td></tr>';
});
