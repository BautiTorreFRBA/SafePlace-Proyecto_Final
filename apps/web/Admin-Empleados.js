/* DATOS SIMULADOS --- Esto se va a traer de la Base de Datos */
let empleados = [
  { id: 'EMP-004', nombre: 'Juan Pérez',       iniciales: 'JP', depto: 'Producción',   rol: 'Trabajador', estado: 'activo',   alta: '14/01/2023' },
  { id: 'EMP-005', nombre: 'Ana Martínez',     iniciales: 'AM', depto: 'Logística',    rol: 'Trabajador', estado: 'activo',   alta: '19/03/2023' },
  { id: 'EMP-006', nombre: 'Pedro López',      iniciales: 'PL', depto: 'Mantenimiento',rol: 'Trabajador', estado: 'activo',   alta: '09/11/2022' },
  { id: 'EMP-007', nombre: 'Laura Rodríguez',  iniciales: 'LR', depto: 'Producción',   rol: 'Trabajador', estado: 'activo',   alta: '31/05/2023' },
  { id: 'EMP-008', nombre: 'Diego Fernández',  iniciales: 'DF', depto: 'Almacén',      rol: 'Trabajador', estado: 'inactivo', alta: '14/08/2022' },
  { id: 'EMP-009', nombre: 'Sofía Herrera',    iniciales: 'SH', depto: 'Producción',   rol: 'Trabajador', estado: 'activo',   alta: '31/08/2023' },
  { id: 'EMP-010', nombre: 'Miguel Torres',    iniciales: 'MT', depto: 'Logística',    rol: 'Trabajador', estado: 'activo',   alta: '04/01/2024' },
  { id: 'EMP-011', nombre: 'Valentina Díaz',   iniciales: 'VD', depto: 'Mantenimiento',rol: 'Trabajador', estado: 'activo',   alta: '19/07/2023' },
];

/* REFERENCIAS AL DOM */
const tableBody   = document.getElementById('empTableBody');
const empCount    = document.getElementById('empCount');
const searchInput = document.getElementById('searchInput');
const filterStatus= document.getElementById('filterStatus');
 
const modalOverlay= document.getElementById('modalOverlay');
const modalTitle  = document.getElementById('modalTitle');
const modalClose  = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalSave   = document.getElementById('modalSave');
const btnNuevo    = document.getElementById('btnNuevo');
 
const mNombre = document.getElementById('mNombre');
const mDept   = document.getElementById('mDept');
const mRol    = document.getElementById('mRol');
 
// Guardamos el id del empleado que estamos editando (null = modo crear)
let editingId = null;
 
/* RENDER DE LA TABLA */
function renderTable() {
  const query  = searchInput.value.trim().toLowerCase();
  const estado = filterStatus.value; // 'todos' | 'activo' | 'inactivo'
 
  // Filtramos el array original sin mutarlo
  const filtrados = empleados.filter(emp => {
    const matchBusqueda = emp.nombre.toLowerCase().includes(query) ||
                          emp.id.toLowerCase().includes(query);
    const matchEstado   = estado === 'todos' || emp.estado === estado;
    return matchBusqueda && matchEstado;
  });
 
  // Actualizamos el contador de empleados mostrados
  empCount.textContent = `${filtrados.length} empleado${filtrados.length !== 1 ? 's' : ''} registrado${filtrados.length !== 1 ? 's' : ''}`;
 
  // Si no hay resultados mostramos una fila de aviso
  if (filtrados.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">
          No se encontraron empleados
        </td>
      </tr>
    `;
    return;
  }
 
  // Construimos el HTML de todas las filas de una sola vez
  tableBody.innerHTML = filtrados.map(emp => rowHTML(emp)).join('');
}
 
/* Devuelve el HTML de una fila a partir de un objeto empleado */
function rowHTML(emp) {
  const esActivo = emp.estado === 'activo';
 
  // Badge de estado: verde si activo, gris si inactivo
  const estadoBadge = esActivo
    ? `<span class="badge badge--normal">● Activo</span>`
    : `<span class="badge badge--neutral">● Inactivo</span>`;
 
  // El botón Desactivar solo aparece si el empleado está activo
  const desactivarBtn = esActivo
    ? `<button class="emp-actions__deactivate" data-id="${emp.id}">Desactivar</button>`
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
      <td style="color:var(--text-muted); font-size:0.82rem">${emp.alta}</td>
      <td>
        <div class="emp-actions">
          <button class="emp-actions__edit" data-id="${emp.id}">Editar</button>
          ${desactivarBtn}
        </div>
      </td>
    </tr>
  `;
}
 
 
/* ------------------------------------------------------------
   4. DELEGACIÓN DE EVENTOS EN LA TABLA
   ------------------------------------------------------------
   En lugar de poner un listener en cada botón (que se recrean
   cada vez que se hace render), escuchamos un solo evento en
   el tbody y detectamos qué botón fue clickeado por su clase.
   ------------------------------------------------------------ */
tableBody.addEventListener('click', (e) => {
 
  // Clic en botón "Editar"
  const editBtn = e.target.closest('.emp-actions__edit');
  if (editBtn) {
    const id = editBtn.dataset.id;
    openModal('editar', id);
    return;
  }
 
  // Clic en botón "Desactivar"
  const deactivateBtn = e.target.closest('.emp-actions__deactivate');
  if (deactivateBtn) {
    const id = deactivateBtn.dataset.id;
    desactivarEmpleado(id);
  }
});
 
 
/* DESACTIVAR EMPLEADO */
function desactivarEmpleado(id) {
  // Encontramos el empleado y cambiamos su estado
  const emp = empleados.find(e => e.id === id);
  if (!emp) return;
 
  emp.estado = 'inactivo';
 
  // Re-renderizamos para reflejar el cambio
  renderTable();
 
  // En producción aquí iría:
  // await fetch(`/api/empleados/${id}/desactivar`, { method: 'PATCH' });
}
 
 
/* MODAL: ABRIR / CERRAR */
 
/* Abre el modal en modo 'crear' o 'editar' */
function openModal(modo, id = null) {
  editingId = id;
 
  if (modo === 'editar') {
    // Cargamos los datos del empleado en los campos del formulario
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;
 
    modalTitle.textContent = 'Editar Empleado';
    mNombre.value = emp.nombre;
    mDept.value   = emp.depto;
    mRol.value    = emp.rol;
 
  } else {
    // Modo crear: limpiamos los campos
    modalTitle.textContent = 'Nuevo Empleado';
    mNombre.value = '';
    mDept.value   = '';
    mRol.value    = '';
  }
 
  // Mostramos el modal con la clase que activa la transición CSS
  modalOverlay.classList.add('modal-overlay--visible');
  mNombre.focus();
}
 
/* Cierra el modal */
function closeModal() {
  modalOverlay.classList.remove('modal-overlay--visible');
  editingId = null;
}
 
 
/* GUARDAR DESDE EL MODAL */
function guardarEmpleado() {
  const nombre = mNombre.value.trim();
  const depto  = mDept.value;
  const rol    = mRol.value;
 
  // Validación básica
  if (!nombre || !depto || !rol) {
    // Marcamos los campos vacíos con un borde de error
    [mNombre, mDept, mRol].forEach(campo => {
      campo.style.borderColor = !campo.value.trim() ? 'var(--red)' : '';
    });
    return;
  }
 
  // Quitamos el borde de error si todo está bien
  [mNombre, mDept, mRol].forEach(c => c.style.borderColor = '');
 
  if (editingId) {
    // ── MODO EDITAR ──────────────────────────────────────────
    const emp = empleados.find(e => e.id === editingId);
    if (emp) {
      emp.nombre    = nombre;
      emp.iniciales = nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      emp.depto     = depto;
      emp.rol       = rol;
    }
    // En producción: await fetch(`/api/empleados/${editingId}`, { method: 'PUT', body: ... })
 
  } else {
    // ── MODO CREAR ───────────────────────────────────────────
    // Generamos un ID incremental tomando el último número de la lista
    const lastNum = empleados.reduce((max, e) => {
      const num = parseInt(e.id.replace('EMP-', ''));
      return num > max ? num : max;
    }, 0);
 
    const nuevoId = `EMP-${String(lastNum + 1).padStart(3, '0')}`;
 
    empleados.push({
      id:        nuevoId,
      nombre,
      iniciales: nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
      depto,
      rol,
      estado:    'activo',
      alta:      new Date().toLocaleDateString('es-AR'),
    });
    // En producción: await fetch('/api/empleados', { method: 'POST', body: ... })
  }
 
  closeModal();
  renderTable();
}
 
 
/* EVENTOS DE BÚSQUEDA, FILTRO Y MODAL */
 
// Búsqueda en tiempo real mientras se escribe
searchInput.addEventListener('input', renderTable);
 
// Cambio en el selector de filtro
filterStatus.addEventListener('change', renderTable);
 
// Botón "+ Nuevo Empleado"
btnNuevo.addEventListener('click', () => openModal('crear'));
 
// Cerrar modal por la X, el botón Cancelar o clic en el fondo
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  // Solo cerramos si el clic fue directamente en el overlay (fondo),
  // no en el contenido del modal
  if (e.target === modalOverlay) closeModal();
});
 
// Guardar desde el modal
modalSave.addEventListener('click', guardarEmpleado);
 
// Guardar también con Enter en cualquier campo del modal
[mNombre, mDept, mRol].forEach(campo => {
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') guardarEmpleado();
  });
});
 
// Limpiar borde de error al empezar a escribir
[mNombre, mDept, mRol].forEach(campo => {
  campo.addEventListener('input', () => { campo.style.borderColor = ''; });
});
 
 
/* INIT */
renderTable();