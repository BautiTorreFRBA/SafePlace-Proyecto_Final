const API_BASE_URL = 'http://localhost:8000/api/v1';

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
const mDept = document.getElementById('mDept');
const mRol = document.getElementById('mRol');

let empleados = [];
let editingId = null;

const iniciales = (nombre = '') =>
  nombre.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

async function cargarEmpleados() {
  const res = await fetch(`${API_BASE_URL}/dashboard/employees`);
  const json = await res.json();
  empleados = (json.data || []).map((emp) => ({
    id: `EMP-${String(emp.id).padStart(3, '0')}`,
    nombre: `${emp.nombre} ${emp.apellido}`.trim(),
    iniciales: iniciales(`${emp.nombre} ${emp.apellido}`),
    depto: emp.depto || 'Sin asignar',
    rol: emp.rol || 'Operario',
    estado: emp.activo ? 'activo' : 'inactivo',
    alta: emp.alta ? new Date(emp.alta).toLocaleDateString('es-AR') : '--',
  }));
  renderTable();
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const estado = filterStatus.value;
  const filtrados = empleados.filter((emp) => {
    const matchBusqueda = emp.nombre.toLowerCase().includes(query) || emp.id.toLowerCase().includes(query);
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
  const estadoBadge = esActivo ? '<span class="badge badge--normal">● Activo</span>' : '<span class="badge badge--neutral">● Inactivo</span>';
  const desactivarBtn = esActivo ? `<button class="emp-actions__deactivate" data-id="${emp.id}">Desactivar</button>` : '';
  return `<tr>
      <td class="emp-id">${emp.id}</td>
      <td><div class="emp-name"><div class="avatar avatar--sm">${emp.iniciales}</div><span class="emp-name__text">${emp.nombre}</span></div></td>
      <td style="color:var(--text-secondary)">${emp.depto}</td>
      <td style="color:var(--text-secondary)">${emp.rol}</td>
      <td>${estadoBadge}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${emp.alta}</td>
      <td><div class="emp-actions"><button class="emp-actions__edit" data-id="${emp.id}">Editar</button>${desactivarBtn}</div></td>
    </tr>`;
}

function openModal(modo, id = null) {
  editingId = id;
  if (modo === 'editar') {
    const emp = empleados.find((e) => e.id === id);
    if (!emp) return;
    modalTitle.textContent = 'Editar Empleado';
    mNombre.value = emp.nombre;
    mDept.value = emp.depto;
    mRol.value = emp.rol;
  } else {
    modalTitle.textContent = 'Nuevo Empleado';
    mNombre.value = '';
    mDept.value = '';
    mRol.value = '';
  }
  modalOverlay.classList.add('modal-overlay--visible');
  mNombre.focus();
}

function closeModal() {
  modalOverlay.classList.remove('modal-overlay--visible');
  editingId = null;
}

function guardarEmpleado() {
  closeModal();
}

tableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.emp-actions__edit');
  if (editBtn) return openModal('editar', editBtn.dataset.id);
  const deactivateBtn = e.target.closest('.emp-actions__deactivate');
  if (deactivateBtn) return;
});

searchInput.addEventListener('input', renderTable);
filterStatus.addEventListener('change', renderTable);
btnNuevo.addEventListener('click', () => openModal('crear'));
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
modalSave.addEventListener('click', guardarEmpleado);
[mNombre, mDept, mRol].forEach((campo) => campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarEmpleado(); }));

cargarEmpleados().catch((err) => {
  console.error(err);
  empCount.textContent = 'Error cargando empleados';
});
