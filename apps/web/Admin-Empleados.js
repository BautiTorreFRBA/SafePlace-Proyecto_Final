const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

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
const mEmail = document.getElementById('mEmail');
const mDept = document.getElementById('mDept');
const EMPLOYEES_ENDPOINT = '/dashboard/employees';
const EMPLOYEE_DEACTIVATE_ENDPOINT = (id) => `/dashboard/employees/${id}/deactivate`;
const sortButtons = Array.from(document.querySelectorAll('.emp-sort'));

let empleados = [];
let editingId = null;
let sortState = {
  key: 'nombreCompleto',
  direction: 'asc',
};

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

function normalizarTexto(valor = '') {
  return String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function setSelectByText(select, texto) {
  const objetivo = normalizarTexto(texto);
  if (!objetivo) {
    select.value = '';
    return;
  }

  const option = Array.from(select.options).find((opt) => normalizarTexto(opt.textContent) === objetivo);
  select.value = option ? option.value : '';
}

function getSortValue(emp, key) {
  switch (key) {
    case 'legajo':
      return normalizarTexto(emp.legajo || '');
    case 'nombreCompleto':
      return normalizarTexto(emp.nombreCompleto || '');
    case 'depto':
      return normalizarTexto(emp.depto || '');
    case 'rol':
      return normalizarTexto(emp.rol || '');
    case 'estado':
      return emp.estado === 'activo' ? 1 : 0;
    case 'alta':
      return emp.alta ? new Date(emp.alta).getTime() : 0;
    default:
      return normalizarTexto(String(emp[key] ?? ''));
  }
}

function ordenarEmpleados(lista) {
  const { key, direction } = sortState;
  const factor = direction === 'asc' ? 1 : -1;

  return [...lista].sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);

    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;
    return 0;
  });
}

function actualizarIndicadoresOrden() {
  sortButtons.forEach((btn) => {
    const activo = btn.dataset.sort === sortState.key;
    btn.classList.toggle('emp-sort--active', activo);
    btn.classList.toggle('emp-sort--desc', activo && sortState.direction === 'desc');
  });
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

function normalizarEmpleado(emp) {
  const nombreCompleto = `${emp.nombre || ''} ${emp.apellido || ''}`.trim();
  const estadoBruto = emp.estado;
  const estaActivo = estadoBruto === true || estadoBruto === 'true';
  return {
    id: emp.id,
    legajo: emp.legajo || `EMP-${String(emp.id).padStart(3, '0')}`,
    nombre: emp.nombre || '',
    apellido: emp.apellido || '',
    email: emp.email || '',
    nombreCompleto: nombreCompleto || 'Sin nombre',
    iniciales: iniciales(nombreCompleto || emp.legajo || ''),
    depto: emp.depto || emp.area || 'Sin asignar',
    rol: emp.rol || 'Operario',
    estado: estaActivo ? 'activo' : 'inactivo',
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

  const ordenados = ordenarEmpleados(filtrados);

  empCount.textContent = `${ordenados.length} empleado${ordenados.length !== 1 ? 's' : ''} registrado${ordenados.length !== 1 ? 's' : ''}`;

  tableBody.innerHTML = ordenados.length === 0
    ? '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se encontraron empleados</td></tr>'
    : ordenados.map((emp) => rowHTML(emp)).join('');

  actualizarIndicadoresOrden();
}

function rowHTML(emp) {
  const esActivo = emp.estado === 'activo';
  const estadoBadge = esActivo
    ? '<span class="badge badge--normal">Activo</span>'
    : '<span class="badge badge--neutral">Inactivo</span>';

  return `<tr>
      <td class="emp-id">${escapeHtml(emp.legajo)}</td>
      <td><div class="emp-name"><div class="avatar avatar--sm">${escapeHtml(emp.iniciales)}</div><span class="emp-name__text">${escapeHtml(emp.nombreCompleto)}</span></div></td>
      <td style="color:var(--text-secondary)">${escapeHtml(emp.depto)}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(emp.rol)}</td>
      <td>${estadoBadge}</td>
      <td style="color:var(--text-primary); font-size:0.82rem">${escapeHtml(emp.alta)}</td>
      <td><div class="emp-actions"><button class="emp-actions__edit" data-id="${emp.id}">Editar</button><button class="emp-actions__deactivate" data-id="${emp.id}" ${esActivo ? '' : 'disabled'}>Desactivar</button></div></td>
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
    mEmail.value = emp.email || '';
    setSelectByText(mDept, emp.depto || emp.area || '');
  } else {
    modalTitle.textContent = 'Nuevo Empleado';
    mNombre.value = '';
    mApellido.value = '';
    mEmail.value = '';
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
  mEmail.value = '';
  mDept.value = '';
}

async function guardarEmpleado() {
  const nombre = mNombre.value.trim();
  const apellido = mApellido.value.trim();
  const email = mEmail.value.trim();
  const area = mDept.value.trim();

  if (!nombre || !apellido || !area || !email) {
    alert('Completá nombre, apellido, departamento y email.');
    return;
  }

  try {
    await apiFetch(editingId ? `${EMPLOYEES_ENDPOINT}/${editingId}` : EMPLOYEES_ENDPOINT, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify({ nombre, apellido, area, email }),
    });
    closeModal();
    limpiarCampos();
    await cargarEmpleados();
  } catch (error) {
    alert(error.message);
  }
}

async function desactivarEmpleado(id) {
  const emp = empleados.find((e) => String(e.id) === String(id));
  if (!emp) return;

  const ok = window.confirm(`Desactivar al empleado ${emp.nombreCompleto}?`);
  if (!ok) return;

  try {
    await apiFetch(EMPLOYEE_DEACTIVATE_ENDPOINT(id), {
      method: 'PATCH',
    });
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

  const deactivateBtn = e.target.closest('.emp-actions__deactivate');
  if (deactivateBtn) {
    return desactivarEmpleado(deactivateBtn.dataset.id);
  }
});

searchInput.addEventListener('input', renderTable);
filterStatus.addEventListener('change', renderTable);
btnNuevo.addEventListener('click', () => openModal('crear'));
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
modalSave.addEventListener('click', guardarEmpleado);
[...sortButtons].forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    if (sortState.key === key) {
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.direction = 'asc';
    }
    renderTable();
  });
});
[mNombre, mApellido, mEmail, mDept].forEach((campo) => campo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    guardarEmpleado();
  }
}));

cargarEmpleados().catch((err) => {
  console.error(err);
  empCount.textContent = 'Error cargando empleados';
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se pudieron cargar los empleados</td></tr>';
});
