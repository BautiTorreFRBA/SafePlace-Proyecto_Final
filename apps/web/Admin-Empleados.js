<<<<<<< Updated upstream
const API_BASE_URL = window.__SAFEPLACE_API_URL__ || (window.location.port === '5173'
  ? 'http://localhost:8000/api/v1'
  : '/api/v1');

=======
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
    throw new Error(payload.error || payload.message || 'No se pudo completar la operación.');
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
=======
async function cargarEmpleados() {
  const res = await fetch(`${API_BASE_URL}/dashboard/employees`, {
    headers: { ...getAuthHeaders() },
  });
  const json = await res.json();
  empleados = (json.data || []).map((emp) => ({
    id: `EMP-${String(emp.id).padStart(3, '0')}`,
    nombre: `${emp.nombre} ${emp.apellido}`.trim(),
    iniciales: iniciales(`${emp.nombre} ${emp.apellido}`),
    depto: emp.depto || 'Sin asignar',
>>>>>>> Stashed changes
    rol: emp.rol || 'Operario',
    estado: emp.activo ? 'activo' : 'inactivo',
    alta: emp.alta ? new Date(emp.alta).toLocaleDateString('es-AR') : '--',
  };
}

async function cargarEmpleados() {
  const json = await apiFetch('/dashboard/employees');
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
    mNombre.value = emp.nombre;
    mApellido.value = emp.apellido;
    mLegajo.value = emp.legajo;
    mDept.value = emp.depto;
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

<<<<<<< Updated upstream
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
    alert('Completá nombre, apellido, legajo y departamento.');
    return;
  }

  try {
    await apiFetch('/dashboard/employees', {
      method: 'POST',
      body: JSON.stringify({ nombre, apellido, legajo, area }),
    });
    closeModal();
    limpiarCampos();
    await cargarEmpleados();
  } catch (error) {
    alert(error.message);
  }
=======
function guardarEmpleado() {
  const payload = {
    nombre: mNombre.value.trim(),
    depto: mDept.value.trim(),
    rol: mRol.value.trim(),
  };

  const method = editingId ? 'PATCH' : 'POST';
  const endpoint = editingId
    ? `${API_BASE_URL}/dashboard/employees/${editingId.replace('EMP-', '')}`
    : `${API_BASE_URL}/dashboard/employees`;

  fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return cargarEmpleados();
    })
    .then(() => closeModal())
    .catch((err) => {
      console.error(err);
      alert('No se pudo guardar el empleado');
    });
>>>>>>> Stashed changes
}

tableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.emp-actions__edit');
<<<<<<< Updated upstream
  if (editBtn) {
    return openModal('editar', editBtn.dataset.id);
=======
  if (editBtn) return openModal('editar', editBtn.dataset.id);
  const deactivateBtn = e.target.closest('.emp-actions__deactivate');
  if (deactivateBtn) {
    const id = deactivateBtn.dataset.id.replace('EMP-', '');
    fetch(`${API_BASE_URL}/dashboard/employees/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return cargarEmpleados();
      })
      .catch((err) => {
        console.error(err);
        alert('No se pudo desactivar el empleado');
      });
>>>>>>> Stashed changes
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
