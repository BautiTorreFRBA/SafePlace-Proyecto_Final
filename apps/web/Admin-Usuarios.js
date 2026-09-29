const API_BASE_URL = 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const USERS_ENDPOINT = `${API_BASE_URL}/dashboard/users`;
const COMPANIES_ENDPOINT = `${API_BASE_URL}/dashboard/companies`;
const CREATE_USER_ENDPOINT = `${API_BASE_URL}/auth/users`;

const tableBody = document.getElementById('usrTableBody');
const usrCount = document.getElementById('usrCount');
const usrSearch = document.getElementById('usrSearch');
const usrRoles = document.getElementById('usrRoles');
const btnNuevoUsuario = document.getElementById('btnNuevoUsuario');
const modalOverlay = document.getElementById('usrModalOverlay');
const modalClose = document.getElementById('usrModalClose');
const modalCancel = document.getElementById('usrModalCancel');
const modalCreate = document.getElementById('usrModalCreate');
const modalTitle = document.querySelector('.usr-modal__title');
const selectEmpresa = document.getElementById('usrEmpresa');
const selectRol = document.getElementById('usrRol');
const inputNombre = document.getElementById('usrNombre');
const inputApellido = document.getElementById('usrApellido');
const inputEmail = document.getElementById('usrEmail');
const inputPassword = document.getElementById('usrPassword');
const supervisorScopeFields = document.getElementById('supervisorScopeFields');
const selectSupervisorArea = document.getElementById('usrSupervisorArea');
const supervisorTurnos = document.getElementById('usrSupervisorTurnos');

let usuarios = [];
let empresas = [];
let editandoId = null;
let rolFiltro = 'todos';

// Orden de los grupos y de los botones de filtro.
const GRUPOS_ROL = [
  ['admin', 'Administradores'],
  ['supervisor', 'Supervisores'],
  ['seguridad', 'Seguridad e Higiene'],
  ['otro', 'Sin rol'],
];

function getAuthHeaders() {
  const token = sessionStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function iniciales(nombre = '', apellido = '') {
  const parts = [nombre, apellido].filter(Boolean);
  return parts.map((part) => part.trim()[0]).join('').toUpperCase();
}

function normalizeRolForApi(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('supervisor')) return 'supervisor';
  if (normalized.includes('seguridad')) return 'seguridad';
  if (normalized.includes('admin')) return 'admin';
  return normalized;
}

function getRolValue(usuario) {
  const raw = getRolLabel(usuario);
  const normalized = normalizeRolForApi(raw);
  if (normalized === 'admin') return 'admin';
  if (normalized === 'supervisor') return 'supervisor';
  if (normalized === 'seguridad') return 'seguridad';
  return '';
}

function getRolDisplay(usuario) {
  const value = getRolValue(usuario);
  if (value === 'admin') return 'Administrador';
  if (value === 'supervisor') return usuario.area_supervisada ? `Supervisor del área ${usuario.area_supervisada}` : 'Supervisor Operativo';
  if (value === 'seguridad') return 'Resp. Seguridad e Higiene';
  return getRolLabel(usuario);
}

function getRolLabel(usuario) {
  if (typeof usuario.rol === 'string' && usuario.rol.trim()) {
    return usuario.rol.trim();
  }

  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];
  const primerRol = roles[0];
  if (!primerRol) return 'Sin rol';

  return String(primerRol.nombre || primerRol.rol || primerRol.codigo || primerRol.slug || primerRol.name || primerRol.tipo || 'Sin rol').trim();
}

function getEmpresaLabel(usuario) {
  if (!usuario.id_empresa && !usuario.idEmpresa) {
    return 'Sin empresa';
  }

  const idEmpresa = usuario.id_empresa ?? usuario.idEmpresa;
  const empresaNombre = usuario.empresa_nombre || usuario.empresaNombre;
  if (empresaNombre) return empresaNombre;

  return String(idEmpresa);
}

async function apiGet(endpoint) {
  const res = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || json.message || `HTTP ${res.status}`);
  }
  return json;
}

async function cargarEmpresas() {
  const json = await apiGet(COMPANIES_ENDPOINT);
  empresas = Array.isArray(json.data) ? json.data : [];
}

function renderEmpresaOptions() {
  selectEmpresa.innerHTML = '<option value="">Selecciona una empresa...</option>';
  empresas.forEach((empresa) => {
    const option = document.createElement('option');
    option.value = String(empresa.id);
    option.textContent = empresa.nombre;
    selectEmpresa.appendChild(option);
  });
}

async function cargarUsuarios() {
  usrCount.textContent = 'Cargando usuarios...';

  try {
    await cargarEmpresas();
    const json = await apiGet(USERS_ENDPOINT);
    usuarios = Array.isArray(json.data) ? json.data : [];
    renderEmpresaOptions();
    renderTabla();
  } catch (error) {
    console.error('No se pudieron cargar los usuarios', error);
    usuarios = [];
    empresas = [];
    renderEmpresaOptions();
    renderTabla('No se pudieron cargar los usuarios');
  }
}

function actualizarContador(total = usuarios.length) {
  usrCount.textContent = `${total} ${total === 1 ? 'usuario del sistema' : 'usuarios del sistema'}`;
}

function rolClave(usuario) {
  return getRolValue(usuario) || 'otro';
}

// Un botón por rol con la cantidad que coincide con la búsqueda; "Sin rol"
// sólo aparece si hay usuarios así.
function renderFiltroRoles(coincidentes) {
  const cantidad = (clave) => coincidentes.filter((usuario) => rolClave(usuario) === clave).length;
  const botones = [['todos', 'Todos', coincidentes.length], ...GRUPOS_ROL
    .filter(([clave]) => clave !== 'otro' || usuarios.some((usuario) => rolClave(usuario) === 'otro'))
    .map(([clave, label]) => [clave, label, cantidad(clave)])];
  usrRoles.innerHTML = botones.map(([clave, label, total]) => `
    <button type="button" class="usr-rol-btn${rolFiltro === clave ? ' usr-rol-btn--activo' : ''}" data-rol="${clave}" aria-pressed="${rolFiltro === clave}">
      ${label} <span class="usr-rol-btn__total">${total}</span>
    </button>`).join('');
}

function renderTabla(mensajeVacio = 'No se encontraron usuarios') {
  const busqueda = usrSearch.value.trim().toLowerCase();
  const coincidentes = usuarios.filter((usuario) => {
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.toLowerCase();
    const email = String(usuario.email || '').toLowerCase();
    const rol = String(getRolLabel(usuario)).toLowerCase();
    return nombreCompleto.includes(busqueda) || email.includes(busqueda) || rol.includes(busqueda);
  });
  const filtrados = rolFiltro === 'todos' ? coincidentes : coincidentes.filter((usuario) => rolClave(usuario) === rolFiltro);

  renderFiltroRoles(coincidentes);
  actualizarContador(filtrados.length);

  if (filtrados.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">
          ${mensajeVacio}
        </td>
      </tr>
    `;
    return;
  }

  const filaUsuario = (usuario) => {
    const nombre = usuario.nombre || usuario.usuario_nombre || '';
    const apellido = usuario.apellido || usuario.usuario_apellido || '';
    const avatar = iniciales(nombre, apellido) || 'US';
    const activo = usuario.activo !== false;

    return `
      <tr>
        <td class="usr-td-avatar">
          <div class="avatar avatar--sm">${avatar}</div>
          <span class="usr-td-nombre">${nombre} ${apellido}</span>
        </td>
        <td class="usr-td-email">${usuario.email || '--'}</td>
        <td class="usr-td-empresa">${getEmpresaLabel(usuario)}</td>
        <td class="usr-td-rol">${getRolDisplay(usuario)}</td>
        <td class="usr-td-estado">
          <span class="usr-badge-estado" style="opacity:${activo ? '1' : '0.55'};">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="usr-td-acciones">
          <button class="usr-btn-editar" data-id="${usuario.id}">Editar</button>
          <button class="usr-btn-desactivar" data-id="${usuario.id}" ${activo ? '' : 'disabled'}>
            Desactivar
          </button>
        </td>
      </tr>
    `;
  };

  // Agrupados por rol: una fila de encabezado por grupo y sus usuarios debajo.
  tableBody.innerHTML = GRUPOS_ROL.map(([clave, label]) => {
    const grupo = filtrados.filter((usuario) => rolClave(usuario) === clave);
    if (grupo.length === 0) return '';
    return `
      <tr class="usr-grupo">
        <td colspan="6">${label} <small>${grupo.length} usuario${grupo.length !== 1 ? 's' : ''}</small></td>
      </tr>
      ${grupo.map(filaUsuario).join('')}`;
  }).join('');
}

// Los selects se muestran como buscadores (operario-autocomplete.js), que sólo
// se actualizan con el evento change; asignar .value por código no lo dispara.
function refrescarSelects(...selects) {
  selects.forEach((select) => select.dispatchEvent(new Event('change', { bubbles: true })));
}

function abrirModal() {
  editandoId = null;
  modalTitle.textContent = 'Nuevo Usuario';
  modalCreate.textContent = 'Crear Usuario';
  modalOverlay.classList.add('usr-modal-overlay--visible');
  limpiarFormulario();
}

function cerrarModal() {
  modalOverlay.classList.remove('usr-modal-overlay--visible');
  limpiarFormulario();
  editandoId = null;
}

function limpiarFormulario() {
  inputNombre.value = '';
  inputApellido.value = '';
  inputEmail.value = '';
  inputPassword.value = '';
  selectEmpresa.value = '';
  selectRol.value = 'supervisor';
  selectSupervisorArea.value = '';
  supervisorTurnos.querySelectorAll('input').forEach((input) => { input.checked = false; });
  refrescarSelects(selectEmpresa, selectRol, selectSupervisorArea);
}

function actualizarCamposSupervisor() {
  supervisorScopeFields.hidden = selectRol.value !== 'supervisor';
}

function turnosSeleccionados() {
  return [...supervisorTurnos.querySelectorAll('input:checked')].map((input) => input.value);
}

async function guardarUsuario() {
  const nombre = inputNombre.value.trim();
  const apellido = inputApellido.value.trim();
  const email = inputEmail.value.trim();
  const password = inputPassword.value;
  const id_empresa = selectEmpresa.value;
  const rol = selectRol.value;
  const area_supervisada = selectSupervisorArea.value;
  const turnos_supervisados = turnosSeleccionados();

  if (!nombre || !apellido || !email || !id_empresa || !rol) {
    alert('Por favor completa todos los campos');
    return;
  }

  if (!editandoId && !password) {
    alert('La contraseña es obligatoria para crear un usuario.');
    return;
  }

  if (rol === 'supervisor' && (!area_supervisada || turnos_supervisados.length === 0)) {
    alert('Para crear un supervisor selecciona un área y al menos un turno.');
    return;
  }

  try {
    const endpoint = editandoId ? `${USERS_ENDPOINT}/${editandoId}` : CREATE_USER_ENDPOINT;
    const res = await fetch(endpoint, {
      method: editandoId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        nombre,
        apellido,
        email,
        ...(password ? { password } : {}),
        id_empresa: Number(id_empresa),
        rol,
        area_supervisada: rol === 'supervisor' ? area_supervisada : null,
        turnos_supervisados: rol === 'supervisor' ? turnos_supervisados : null,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }

    await cargarUsuarios();
    cerrarModal();
  } catch (error) {
    console.error('No se pudo guardar el usuario', error);
    alert(error.message || 'No se pudo guardar el usuario');
  }
}

function editarUsuario(id) {
  const usuario = usuarios.find((item) => String(item.id) === String(id));
  if (!usuario) return;

  editandoId = String(usuario.id);
  modalTitle.textContent = 'Editar Usuario';
  modalCreate.textContent = 'Guardar Cambios';

  inputNombre.value = usuario.nombre || usuario.usuario_nombre || '';
  inputApellido.value = usuario.apellido || usuario.usuario_apellido || '';
  inputEmail.value = usuario.email || '';
  inputPassword.value = '';
  selectEmpresa.value = String(usuario.id_empresa ?? usuario.idEmpresa ?? '');
  selectRol.value = getRolValue(usuario) || 'supervisor';
  selectSupervisorArea.value = usuario.area_supervisada || '';
  const turnos = Array.isArray(usuario.turnos_supervisados) ? usuario.turnos_supervisados : [];
  supervisorTurnos.querySelectorAll('input').forEach((input) => { input.checked = turnos.includes(input.value); });
  refrescarSelects(selectEmpresa, selectRol, selectSupervisorArea);
  modalOverlay.classList.add('usr-modal-overlay--visible');
}

async function desactivarUsuario(id) {
  const usuario = usuarios.find((item) => String(item.id) === String(id));
  if (!usuario) return;

  const ok = window.confirm(`Desactivar al usuario ${usuario.nombre || usuario.usuario_nombre || ''} ${usuario.apellido || usuario.usuario_apellido || ''}?`);
  if (!ok) return;

  try {
    const res = await fetch(`${USERS_ENDPOINT}/${id}/deactivate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }

    await cargarUsuarios();
  } catch (error) {
    console.error('No se pudo desactivar el usuario', error);
    alert(error.message || 'No se pudo desactivar el usuario');
  }
}

btnNuevoUsuario.addEventListener('click', abrirModal);
modalClose.addEventListener('click', cerrarModal);
modalCancel.addEventListener('click', cerrarModal);
modalCreate.addEventListener('click', guardarUsuario);
usrSearch.addEventListener('input', () => renderTabla());
usrRoles.addEventListener('click', (e) => {
  const boton = e.target.closest('.usr-rol-btn');
  if (!boton) return;
  rolFiltro = boton.dataset.rol;
  renderTabla();
});
selectRol.addEventListener('change', actualizarCamposSupervisor);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    cerrarModal();
  }
});

document.addEventListener('click', (e) => {
  const btnEditar = e.target.closest('.usr-btn-editar');
  if (btnEditar) {
    editarUsuario(btnEditar.dataset.id);
    return;
  }

  const btnDesactivar = e.target.closest('.usr-btn-desactivar');
  if (btnDesactivar) {
    desactivarUsuario(btnDesactivar.dataset.id);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && modalOverlay.classList.contains('usr-modal-overlay--visible')) {
    guardarUsuario();
  }
});

cargarUsuarios();
