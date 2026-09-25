const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

const empGrupos = document.getElementById('empGrupos');
const empCount = document.getElementById('empCount');
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterArea = document.getElementById('filterArea');
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
const mTurno = document.getElementById('mTurno');
const EMPLOYEES_ENDPOINT = '/dashboard/employees';
const EMPLOYEE_DEACTIVATE_ENDPOINT = (id) => `/dashboard/employees/${id}/deactivate`;
const TURNOS = ['mañana', 'tarde', 'noche'];
const etiquetaTurno = (turno) => (turno ? turno.charAt(0).toUpperCase() + turno.slice(1) : 'Sin turno');
// Columnas de cada tabla de grupo. Área y turno no se repiten: ya los da el grupo.
const COLUMNAS = [
  ['legajo', 'LEGAJO'],
  ['nombreCompleto', 'NOMBRE'],
  ['rol', 'ROL'],
  ['fcFatiga', 'FC FATIGA', 'FC de fatiga que se le aplica', 'center'],
  ['fcSobreesfuerzo', 'FC SOBREESFUERZO', 'FC de sobreesfuerzo que se le aplica', 'center'],
  ['fcOrigen', 'CONFIGURACIÓN', 'General (Configuración Operativa) o Particular', 'center'],
  ['estado', 'ESTADO'],
  ['alta', 'ALTA'],
];

let empleados = [];
// Umbrales de FC: el global (Configuración Operativa) y las excepciones por
// operario (Configuración particular), indexadas por id de operario.
let umbralGlobal = null;
let umbralesParticulares = new Map();
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
    case 'turno':
      return normalizarTexto(emp.turno || '');
    case 'rol':
      return normalizarTexto(emp.rol || '');
    case 'estado':
      return emp.estado === 'activo' ? 1 : 0;
    case 'alta':
      return emp.alta ? new Date(emp.alta).getTime() : 0;
    case 'fcFatiga':
      return fcDeEmpleado(emp)?.fatiga ?? Number.MAX_SAFE_INTEGER;
    case 'fcSobreesfuerzo':
      return fcDeEmpleado(emp)?.sobreesfuerzo ?? Number.MAX_SAFE_INTEGER;
    case 'fcOrigen': {
      const fc = fcDeEmpleado(emp);
      return fc ? (fc.particular ? 0 : 1) : 2;
    }
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
  empGrupos.querySelectorAll('.emp-sort').forEach((btn) => {
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
    const error = new Error(payload.error || payload.message || `No se pudo completar la operación (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
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
    turno: emp.turno || '',
    rol: emp.rol || 'Operario',
    estado: estaActivo ? 'activo' : 'inactivo',
    alta: emp.alta ? fmtARFecha(new Date(emp.alta)) : '--',
  };
}

// FC que el Motor de Reglas le aplica al operario: la particular si tiene, o la global.
function fcDeEmpleado(emp) {
  const particular = umbralesParticulares.get(String(emp.id));
  if (!particular && !umbralGlobal) return null;
  const fatiga = particular?.fc_fatiga ?? umbralGlobal?.fc_fatiga;
  const sobreesfuerzo = particular?.fc_sobreesfuerzo ?? umbralGlobal?.fc_sobreesfuerzo;
  if (fatiga == null || sobreesfuerzo == null) return null;
  return { fatiga: Number(fatiga), sobreesfuerzo: Number(sobreesfuerzo), particular: Boolean(particular) };
}

// Si los umbrales no se pueden leer la tabla de empleados se muestra igual,
// con la columna de FC en "--".
async function cargarUmbrales() {
  const [global, particulares] = await Promise.allSettled([apiFetch('/umbrales'), apiFetch('/umbrales-operario')]);
  umbralGlobal = global.status === 'fulfilled' ? global.value?.data || null : null;
  umbralesParticulares = new Map(particulares.status === 'fulfilled'
    ? (particulares.value?.data || []).map((p) => [String(p.id_operario), p])
    : []);
  [global, particulares].filter((r) => r.status === 'rejected').forEach((r) => console.error(r.reason));
}

async function cargarEmpleados() {
  const [json] = await Promise.all([apiFetch(EMPLOYEES_ENDPOINT), cargarUmbrales()]);
  empleados = (json.data || []).map(normalizarEmpleado);
  poblarFiltroArea();
  renderTable();
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const estado = filterStatus.value;
  const area = filterArea.value;

  const filtrados = empleados.filter((emp) => {
    const matchBusqueda = !query
      || emp.nombreCompleto.toLowerCase().includes(query)
      || emp.legajo.toLowerCase().includes(query)
      || String(emp.id).toLowerCase().includes(query);
    const matchEstado = estado === 'todos' || emp.estado === estado;
    const matchArea = area === 'todas' || emp.depto === area;
    return matchBusqueda && matchEstado && matchArea;
  });

  const ordenados = ordenarEmpleados(filtrados);

  empCount.textContent = `${ordenados.length} empleado${ordenados.length !== 1 ? 's' : ''} registrado${ordenados.length !== 1 ? 's' : ''}`;

  empGrupos.innerHTML = ordenados.length === 0
    ? mensajeHTML('No se encontraron empleados')
    : agruparPorAreaYTurno(ordenados).map(grupoAreaHTML).join('');

  actualizarIndicadoresOrden();
}

// Opciones del filtro según las áreas que existen en los empleados cargados;
// se conserva la elegida si sigue existiendo después de recargar.
function poblarFiltroArea() {
  const actual = filterArea.value;
  const areas = [...new Set(empleados.map((emp) => emp.depto))]
    .sort((a, b) => (a === 'Sin asignar') - (b === 'Sin asignar') || a.localeCompare(b, 'es'));
  filterArea.innerHTML = '<option value="todas">Todas las áreas</option>'
    + areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('');
  filterArea.value = areas.includes(actual) ? actual : 'todas';
}

function mensajeHTML(texto) {
  return `<p class="emp-grupos__mensaje">${escapeHtml(texto)}</p>`;
}

// Área → turno, en el orden de Horarios Laborales (áreas alfabéticas, turnos
// mañana/tarde/noche). Dentro de cada grupo se respeta el orden elegido.
function agruparPorAreaYTurno(lista) {
  const areas = new Map();
  lista.forEach((emp) => {
    const area = emp.depto || 'Sin asignar';
    const turno = String(emp.turno || '').toLowerCase();
    if (!areas.has(area)) areas.set(area, new Map());
    if (!areas.get(area).has(turno)) areas.get(area).set(turno, []);
    areas.get(area).get(turno).push(emp);
  });
  const ordenTurno = (t) => (TURNOS.includes(t) ? TURNOS.indexOf(t) : TURNOS.length);
  return [...areas.entries()]
    .sort(([a], [b]) => (a === 'Sin asignar') - (b === 'Sin asignar') || a.localeCompare(b, 'es'))
    .map(([area, turnos]) => ({
      area,
      total: [...turnos.values()].reduce((acc, l) => acc + l.length, 0),
      turnos: [...turnos.entries()].sort(([a], [b]) => ordenTurno(a) - ordenTurno(b)),
    }));
}

function grupoAreaHTML({ area, total, turnos }) {
  return `<section class="area-turno-seccion">
      <h3 class="area-turno-seccion__titulo">${escapeHtml(area)} <small>${total} empleado${total !== 1 ? 's' : ''}</small></h3>
      <div class="emp-grupos__turnos">
        ${turnos.map(([turno, lista]) => `<article class="grupo-area-turno">
          <header class="grupo-area-turno__header">
            <h4>${escapeHtml(etiquetaTurno(turno))}</h4>
            <span>${lista.length} empleado${lista.length !== 1 ? 's' : ''}</span>
          </header>
          <div class="emp-grupos__tabla">
            <table class="emp-table">
              <thead><tr>${COLUMNAS.map(([key, label, title, align]) => `<th${align === 'center' ? ' class="emp-col--center"' : ''}><button class="emp-sort" type="button" data-sort="${key}"${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</button></th>`).join('')}<th></th></tr></thead>
              <tbody>${lista.map(rowHTML).join('')}</tbody>
            </table>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
}

// Una celda por dato: FC de fatiga, FC de sobreesfuerzo y de dónde salen.
function fcCeldasHTML(emp) {
  const fc = fcDeEmpleado(emp);
  const vacio = '<td class="emp-col--center"><span style="color:var(--text-muted)">--</span></td>';
  if (!fc) return vacio.repeat(3);
  const valor = (bpm) => `<td class="emp-col--center"><span class="emp-fc__valor"><strong>${escapeHtml(bpm)}</strong> <small>BPM</small></span></td>`;
  const origen = fc.particular
    ? '<span class="emp-fc__origen emp-fc__origen--particular" title="Configuración particular">Particular</span>'
    : '<span class="emp-fc__origen" title="Umbral general de Configuración Operativa">General</span>';
  return `${valor(fc.fatiga)}${valor(fc.sobreesfuerzo)}<td class="emp-col--center">${origen}</td>`;
}

function rowHTML(emp) {
  const esActivo = emp.estado === 'activo';
  const estadoBadge = esActivo
    ? '<span class="badge badge--normal">Activo</span>'
    : '<span class="badge badge--neutral">Inactivo</span>';

  return `<tr>
      <td class="emp-id">${escapeHtml(emp.legajo)}</td>
      <td><div class="emp-name"><div class="avatar avatar--sm">${escapeHtml(emp.iniciales)}</div><span class="emp-name__text">${escapeHtml(emp.nombreCompleto)}</span></div></td>
      <td style="color:var(--text-secondary)">${escapeHtml(emp.rol)}</td>
      ${fcCeldasHTML(emp)}
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
    mTurno.value = emp.turno || '';
  } else {
    modalTitle.textContent = 'Nuevo Empleado';
    mNombre.value = '';
    mApellido.value = '';
    mEmail.value = '';
    mDept.value = '';
    mTurno.value = '';
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
  mTurno.value = '';
}

async function guardarEmpleado() {
  const nombre = mNombre.value.trim();
  const apellido = mApellido.value.trim();
  const email = mEmail.value.trim();
  const area = mDept.value.trim();
  const turno = mTurno.value;

  if (!nombre || !apellido || !area || !email || !turno) {
    alert('Completá nombre, apellido, departamento, turno y email.');
    return;
  }

  try {
    await apiFetch(editingId ? `${EMPLOYEES_ENDPOINT}/${editingId}` : EMPLOYEES_ENDPOINT, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify({ nombre, apellido, area, email, turno }),
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

empGrupos.addEventListener('click', (e) => {
  const sortBtn = e.target.closest('.emp-sort');
  if (sortBtn) {
    const key = sortBtn.dataset.sort;
    if (sortState.key === key) {
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.direction = 'asc';
    }
    renderTable();
    return undefined;
  }

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
filterArea.addEventListener('change', renderTable);
btnNuevo.addEventListener('click', () => openModal('crear'));
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
modalSave.addEventListener('click', guardarEmpleado);
[mNombre, mApellido, mEmail, mDept, mTurno].forEach((campo) => campo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    guardarEmpleado();
  }
}));

cargarEmpleados().catch((err) => {
  console.error(err);
  empCount.textContent = err.status === 401 || err.status === 403
    ? 'Sesión sin permisos para consultar empleados'
    : 'Error cargando empleados';
  empGrupos.innerHTML = mensajeHTML(err.message || 'No se pudieron cargar los empleados');
});
