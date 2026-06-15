const API_URL = 'https://safeplace-backend.onrender.com/api/v1';

function getToken() { return sessionStorage.getItem('token'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

// Mapea un worker del backend al formato que usa la tabla
function mapWorker(w) {
  const nombre = `${w.nombre} ${w.apellido}`.trim();
  return {
    _id:      w.id,
    id:       `EMP-${String(w.id).padStart(3, '0')}`,
    nombre,
    iniciales: nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    depto:    w.area,
    rol:      'Trabajador',
    estado:   w.estado,
    alta:     w.alta ? new Date(w.alta).toLocaleDateString('es-AR') : '-',
  };
}

let empleados = [];

/* REFERENCIAS AL DOM */
const tableBody    = document.getElementById('empTableBody');
const empCount     = document.getElementById('empCount');
const searchInput  = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');

const modalOverlay = document.getElementById('modalOverlay');
const modalTitle   = document.getElementById('modalTitle');
const modalClose   = document.getElementById('modalClose');
const modalCancel  = document.getElementById('modalCancel');
const modalSave    = document.getElementById('modalSave');
const btnNuevo     = document.getElementById('btnNuevo');

const mNombre = document.getElementById('mNombre');
const mDept   = document.getElementById('mDept');
const mRol    = document.getElementById('mRol');

let editingId = null;

/* CARGAR TRABAJADORES DESDE LA API */
async function cargarEmpleados() {
  try {
    const res  = await fetch(`${API_URL}/workers`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar empleados');
    const data = await res.json();
    empleados  = data.map(mapWorker);
    renderTable();
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Error al cargar empleados</td></tr>`;
  }
}

/* RENDER DE LA TABLA */
function renderTable() {
  const query  = searchInput.value.trim().toLowerCase();
  const estado = filterStatus.value;

  const filtrados = empleados.filter(emp => {
    const matchBusqueda = emp.nombre.toLowerCase().includes(query) || emp.id.toLowerCase().includes(query);
    const matchEstado   = estado === 'todos' || emp.estado === estado;
    return matchBusqueda && matchEstado;
  });

  empCount.textContent = `${filtrados.length} empleado${filtrados.length !== 1 ? 's' : ''} registrado${filtrados.length !== 1 ? 's' : ''}`;

  if (filtrados.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);font-size:0.875rem;">No se encontraron empleados</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtrados.map(rowHTML).join('');
}

function rowHTML(emp) {
  const esActivo    = emp.estado === 'activo';
  const estadoBadge = esActivo
    ? `<span class="badge badge--normal">● Activo</span>`
    : `<span class="badge badge--neutral">● Inactivo</span>`;
  const desactivarBtn = esActivo
    ? `<button class="emp-actions__deactivate" data-id="${emp._id}">Desactivar</button>`
    : '';

  return `
    <tr>
      <td class="emp-id">${emp.id}</td>
      <td>
        <div class="emp-name">
          <div class="avatar avatar--sm">${emp.iniciales}</div>
          <span class="emp-name__text">${emp.nombre}</span>
        </div>
      </td>
      <td style="color:var(--text-secondary)">${emp.depto}</td>
      <td style="color:var(--text-secondary)">${emp.rol}</td>
      <td>${estadoBadge}</td>
      <td style="color:var(--text-muted);font-size:0.82rem">${emp.alta}</td>
      <td>
        <div class="emp-actions">
          <button class="emp-actions__edit" data-id="${emp._id}">Editar</button>
          ${desactivarBtn}
        </div>
      </td>
    </tr>
  `;
}

/* DELEGACIÓN DE EVENTOS EN LA TABLA */
tableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.emp-actions__edit');
  if (editBtn) { openModal('editar', editBtn.dataset.id); return; }

  const deactivateBtn = e.target.closest('.emp-actions__deactivate');
  if (deactivateBtn) { desactivarEmpleado(deactivateBtn.dataset.id); }
});

/* DESACTIVAR EMPLEADO */
async function desactivarEmpleado(id) {
  try {
    const res = await fetch(`${API_URL}/workers/${id}/deactivate`, { method: 'PATCH', headers: authHeaders() });
    if (!res.ok) throw new Error('Error al desactivar');
    await cargarEmpleados();
  } catch (err) {
    console.error(err);
  }
}

/* MODAL */
function openModal(modo, id = null) {
  editingId = id ? parseInt(id) : null;

  if (modo === 'editar') {
    const emp = empleados.find(e => e._id === parseInt(id));
    if (!emp) return;
    modalTitle.textContent = 'Editar Empleado';
    mNombre.value = emp.nombre;
    mDept.value   = emp.depto;
    mRol.value    = emp.rol;
  } else {
    modalTitle.textContent = 'Nuevo Empleado';
    mNombre.value = '';
    mDept.value   = '';
    mRol.value    = '';
  }

  modalOverlay.classList.add('modal-overlay--visible');
  mNombre.focus();
}

function closeModal() {
  modalOverlay.classList.remove('modal-overlay--visible');
  editingId = null;
}

/* GUARDAR */
async function guardarEmpleado() {
  const nombre = mNombre.value.trim();
  const depto  = mDept.value;
  const rol    = mRol.value;

  if (!nombre || !depto || !rol) {
    [mNombre, mDept, mRol].forEach(c => { c.style.borderColor = !c.value.trim() ? 'var(--red)' : ''; });
    return;
  }
  [mNombre, mDept, mRol].forEach(c => c.style.borderColor = '');

  const partes   = nombre.split(' ');
  const apellido = partes.slice(1).join(' ') || '-';

  try {
    if (editingId) {
      const res = await fetch(`${API_URL}/workers/${editingId}`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify({ nombre: partes[0], apellido, area: depto, dni: String(editingId) }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
    } else {
      const dni = `DNI-${Date.now()}`;
      const res = await fetch(`${API_URL}/workers`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ nombre: partes[0], apellido, area: depto, dni }),
      });
      if (!res.ok) throw new Error('Error al crear');
    }

    closeModal();
    await cargarEmpleados();
  } catch (err) {
    console.error(err);
  }
}

/* EVENTOS */
searchInput.addEventListener('input', renderTable);
filterStatus.addEventListener('change', renderTable);
btnNuevo.addEventListener('click', () => openModal('crear'));
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
modalSave.addEventListener('click', guardarEmpleado);
[mNombre, mDept, mRol].forEach(c => {
  c.addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarEmpleado(); });
  c.addEventListener('input',   () => { c.style.borderColor = ''; });
});

/* INIT */
cargarEmpleados();
