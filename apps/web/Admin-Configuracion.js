const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const btnGuardar = document.getElementById('btnGuardar');
const savedMessage = document.getElementById('cfgSaved');
const input = (id) => document.getElementById(id);
const numberValue = (id) => Number(input(id).value);

const UMBRAL_CAMPOS = [
  'fcFatiga', 'minutosFatiga', 'fcSobreesfuerzo',
  'actividadSobreesfuerzo', 'minutosInactividad', 'minutosDesconexionTolerada',
];

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; return null; }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detalle = payload.message || payload.error || `Error HTTP ${response.status}`;
    throw new Error(detalle);
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Umbrales globales (umbral_riesgo, vía /umbrales) ----

function umbralDesdeFormulario() {
  return Object.fromEntries(UMBRAL_CAMPOS.map((id) => [id, numberValue(id)]));
}

function aplicarUmbral(umbral) {
  if (!umbral) return;
  UMBRAL_CAMPOS.forEach((id) => {
    const columna = id.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (umbral[columna] != null) input(id).value = umbral[columna];
  });
}

async function cargarConfiguracion() {
  const payload = await apiFetch('/umbrales');
  aplicarUmbral(payload.data);
}

async function guardarConfiguracion() {
  const umbral = umbralDesdeFormulario();
  if (Object.values(umbral).some((valor) => !Number.isFinite(valor) || valor <= 0)) {
    alert('Todos los valores numéricos deben ser positivos.'); return;
  }
  try {
    btnGuardar.disabled = true;
    await apiFetch('/umbrales', { method: 'PUT', body: JSON.stringify(umbral) });
    savedMessage.textContent = '✓ Guardado en la base de datos';
    savedMessage.classList.add('cfg-saved--visible');
    setTimeout(() => savedMessage.classList.remove('cfg-saved--visible'), 2500);
  } catch (error) { alert(error.message); }
  finally { btnGuardar.disabled = false; }
}

document.querySelectorAll('.cfg-spinner__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = input(btn.dataset.target);
    const step = Number(target.step) || 1;
    target.value = btn.dataset.dir === 'up' ? Number(target.value) + step : Math.max(0, Number(target.value) - step);
  });
});
btnGuardar.addEventListener('click', guardarConfiguracion);

// ---- Trabajos (/trabajos): umbrales por tipo de tarea ----

const trabajoTableBody = document.getElementById('trabajoTableBody');
const btnNuevoTrabajo = document.getElementById('btnNuevoTrabajo');
const trabajoModalOverlay = document.getElementById('trabajoModalOverlay');
const trabajoModalTitle = document.getElementById('trabajoModalTitle');
const trabajoModalClose = document.getElementById('trabajoModalClose');
const trabajoModalCancel = document.getElementById('trabajoModalCancel');
const trabajoModalSave = document.getElementById('trabajoModalSave');
const tActivoField = document.getElementById('tActivoField');

const T_CAMPOS = [
  ['tFcFatiga', 'fcFatiga'], ['tMinutosFatiga', 'minutosFatiga'],
  ['tFcSobreesfuerzo', 'fcSobreesfuerzo'], ['tActividadSobreesfuerzo', 'actividadSobreesfuerzo'],
  ['tMinutosInactividad', 'minutosInactividad'], ['tMinutosDesconexionTolerada', 'minutosDesconexionTolerada'],
];

let trabajos = [];
let editandoTrabajoId = null;

async function cargarTrabajos() {
  const payload = await apiFetch('/trabajos');
  trabajos = payload.data || [];
  renderTrabajos();
}

function renderTrabajos() {
  trabajoTableBody.innerHTML = trabajos.length === 0
    ? '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.875rem;">Sin trabajos configurados — todas las ventanas usan el umbral global</td></tr>'
    : trabajos.map((t) => `
      <tr>
        <td>${escapeHtml(t.nombre)}</td>
        <td style="color:var(--text-secondary)">${escapeHtml(t.descripcion || '--')}</td>
        <td>${t.activo ? '<span class="badge badge--normal">Activo</span>' : '<span class="badge badge--neutral">Inactivo</span>'}</td>
        <td><div class="emp-actions"><button class="emp-actions__edit" data-id="${t.id}">Editar</button></div></td>
      </tr>
    `).join('');
}

function abrirModalTrabajo(id = null) {
  editandoTrabajoId = id;
  const t = id ? trabajos.find((x) => String(x.id) === String(id)) : null;

  trabajoModalTitle.textContent = t ? 'Editar Trabajo' : 'Nuevo Trabajo';
  input('tNombre').value = t?.nombre || '';
  input('tDescripcion').value = t?.descripcion || '';
  T_CAMPOS.forEach(([campoId, prop]) => {
    input(campoId).value = t ? t[prop.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] : input(campoId).defaultValue;
  });
  tActivoField.style.display = t ? '' : 'none';
  input('tActivo').checked = t ? Boolean(t.activo) : true;

  trabajoModalOverlay.classList.add('modal-overlay--visible');
}

function cerrarModalTrabajo() {
  trabajoModalOverlay.classList.remove('modal-overlay--visible');
  editandoTrabajoId = null;
}

async function guardarTrabajo() {
  const nombre = input('tNombre').value.trim();
  if (!nombre) { alert('El nombre del trabajo es obligatorio.'); return; }

  const datos = {
    nombre,
    descripcion: input('tDescripcion').value.trim(),
    activo: input('tActivo').checked,
  };
  T_CAMPOS.forEach(([campoId, prop]) => { datos[prop] = Number(input(campoId).value); });

  if (Object.values(datos).filter((v) => typeof v === 'number').some((v) => !Number.isFinite(v) || v <= 0)) {
    alert('Los umbrales deben ser números positivos.'); return;
  }

  try {
    trabajoModalSave.disabled = true;
    await apiFetch(editandoTrabajoId ? `/trabajos/${editandoTrabajoId}` : '/trabajos', {
      method: editandoTrabajoId ? 'PUT' : 'POST',
      body: JSON.stringify(datos),
    });
    cerrarModalTrabajo();
    await cargarTrabajos();
  } catch (error) {
    alert(error.message);
  } finally {
    trabajoModalSave.disabled = false;
  }
}

trabajoTableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.emp-actions__edit');
  if (editBtn) abrirModalTrabajo(editBtn.dataset.id);
});
btnNuevoTrabajo.addEventListener('click', () => abrirModalTrabajo());
trabajoModalClose.addEventListener('click', cerrarModalTrabajo);
trabajoModalCancel.addEventListener('click', cerrarModalTrabajo);
trabajoModalOverlay.addEventListener('click', (e) => { if (e.target === trabajoModalOverlay) cerrarModalTrabajo(); });
trabajoModalSave.addEventListener('click', guardarTrabajo);

cargarConfiguracion().catch((error) => alert(`No se pudo cargar la configuración: ${error.message}`));
cargarTrabajos().catch((error) => alert(`No se pudieron cargar los trabajos: ${error.message}`));
