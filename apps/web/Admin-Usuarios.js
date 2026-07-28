const API_BASE_URL = 'http://localhost:8000/api/v1';
const USERS_ENDPOINT = `${API_BASE_URL}/dashboard/users`;
const COMPANIES_ENDPOINT = `${API_BASE_URL}/dashboard/companies`;
const CREATE_USER_ENDPOINT = `${API_BASE_URL}/auth/users`;

const tableBody = document.getElementById('usrTableBody');
const usrCount = document.getElementById('usrCount');
const usrSearch = document.getElementById('usrSearch');
const btnNuevoUsuario = document.getElementById('btnNuevoUsuario');
const modalOverlay = document.getElementById('usrModalOverlay');
const modalClose = document.getElementById('usrModalClose');
const modalCancel = document.getElementById('usrModalCancel');
const modalCreate = document.getElementById('usrModalCreate');
const selectEmpresa = document.getElementById('usrEmpresa');
const selectRol = document.getElementById('usrRol');

let usuarios = [];
let empresas = [];

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

function renderTabla(mensajeVacio = 'No se encontraron usuarios') {
  const busqueda = usrSearch.value.trim().toLowerCase();
  const filtrados = usuarios.filter((usuario) => {
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.toLowerCase();
    const email = String(usuario.email || '').toLowerCase();
    const rol = String(getRolLabel(usuario)).toLowerCase();
    return nombreCompleto.includes(busqueda) || email.includes(busqueda) || rol.includes(busqueda);
  });

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

  tableBody.innerHTML = filtrados.map((usuario) => {
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
        <td class="usr-td-rol">${getRolLabel(usuario)}</td>
        <td class="usr-td-estado">
          <span class="usr-badge-estado" style="opacity:${activo ? '1' : '0.55'};">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="usr-td-acciones">
          <button class="usr-btn-editar" data-id="${usuario.id}">Editar</button>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirModal() {
  modalOverlay.classList.add('usr-modal-overlay--visible');
  limpiarFormulario();
}

function cerrarModal() {
  modalOverlay.classList.remove('usr-modal-overlay--visible');
  limpiarFormulario();
}

function limpiarFormulario() {
  document.getElementById('usrNombre').value = '';
  document.getElementById('usrApellido').value = '';
  document.getElementById('usrEmail').value = '';
  document.getElementById('usrPassword').value = '';
  selectEmpresa.value = '';
  selectRol.value = 'supervisor';
  document.getElementById('usrActivo').checked = true;
}

async function crearUsuario() {
  const nombre = document.getElementById('usrNombre').value.trim();
  const apellido = document.getElementById('usrApellido').value.trim();
  const email = document.getElementById('usrEmail').value.trim();
  const password = document.getElementById('usrPassword').value;
  const id_empresa = selectEmpresa.value;
  const rol = normalizeRolForApi(selectRol.value);
  const activo = document.getElementById('usrActivo').checked;

  if (!nombre || !apellido || !email || !password || !id_empresa || !rol) {
    alert('Por favor completa todos los campos');
    return;
  }

  try {
    const res = await fetch(CREATE_USER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        nombre,
        apellido,
        email,
        password,
        id_empresa: Number(id_empresa),
        rol,
        activo,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }

    await cargarUsuarios();
    cerrarModal();
  } catch (error) {
    console.error('No se pudo crear el usuario', error);
    alert(error.message || 'No se pudo crear el usuario');
  }
}

function editarUsuario(id) {
  const usuario = usuarios.find((item) => String(item.id) === String(id));
  if (!usuario) return;

  document.getElementById('usrNombre').value = usuario.nombre || usuario.usuario_nombre || '';
  document.getElementById('usrApellido').value = usuario.apellido || usuario.usuario_apellido || '';
  document.getElementById('usrEmail').value = usuario.email || '';
  selectEmpresa.value = String(usuario.id_empresa ?? usuario.idEmpresa ?? '');
  selectRol.value = normalizeRolForApi(getRolLabel(usuario));
  document.getElementById('usrActivo').checked = usuario.activo !== false;
  abrirModal();
}

btnNuevoUsuario.addEventListener('click', abrirModal);
modalClose.addEventListener('click', cerrarModal);
modalCancel.addEventListener('click', cerrarModal);
modalCreate.addEventListener('click', crearUsuario);
usrSearch.addEventListener('input', () => renderTabla());

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    cerrarModal();
  }
});

document.addEventListener('click', (e) => {
  const btnEditar = e.target.closest('.usr-btn-editar');
  if (!btnEditar) return;
  editarUsuario(btnEditar.dataset.id);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && modalOverlay.classList.contains('usr-modal-overlay--visible')) {
    crearUsuario();
  }
});

cargarUsuarios();
