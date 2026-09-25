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

// ---- Configuración particular (/umbrales-operario): FC propias por operario ----
// Se guardan en operario."FC_Fatiga" / "FC_Sobreesfuerzo"; el id de cada fila es el del operario.

const particularTableBody = document.getElementById('particularTableBody');
const btnNuevaParticular = document.getElementById('btnNuevaParticular');
const particularModalOverlay = document.getElementById('particularModalOverlay');
const particularModalTitle = document.getElementById('particularModalTitle');
const particularModalClose = document.getElementById('particularModalClose');
const particularModalCancel = document.getElementById('particularModalCancel');
const particularModalSave = document.getElementById('particularModalSave');
const pOperario = document.getElementById('pOperario');
const pHint = document.getElementById('pHint');

let particulares = [];
let operarios = [];
let editandoParticularId = null;

const nombreOperario = (o) => `${o.apellido || ''}, ${o.nombre || ''}`.replace(/^, |, $/g, '').trim() || `Operario ${o.id}`;

async function cargarParticulares() {
  const payload = await apiFetch('/umbrales-operario');
  particulares = payload.data || [];
  renderParticulares();
}

async function cargarOperarios() {
  const payload = await apiFetch('/trabajadores');
  operarios = (payload.data || [])
    .filter((o) => o.estado !== false)
    .sort((a, b) => nombreOperario(a).localeCompare(nombreOperario(b), 'es'));
}

function renderParticulares() {
  particularTableBody.innerHTML = particulares.length === 0
    ? '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.875rem;">Sin configuraciones particulares — todos los operarios usan los umbrales de arriba</td></tr>'
    : particulares.map((p) => `
      <tr>
        <td>${escapeHtml(nombreOperario({ id: p.id_operario, nombre: p.operario_nombre, apellido: p.operario_apellido }))}</td>
        <td class="emp-id">${escapeHtml(p.operario_legajo || '--')}</td>
        <td>${p.fc_fatiga != null ? `<strong>${escapeHtml(p.fc_fatiga)}</strong> <span style="color:var(--text-muted)">BPM</span>` : '<span style="color:var(--text-muted)">General</span>'}</td>
        <td>${p.fc_sobreesfuerzo != null ? `<strong>${escapeHtml(p.fc_sobreesfuerzo)}</strong> <span style="color:var(--text-muted)">BPM</span>` : '<span style="color:var(--text-muted)">General</span>'}</td>
        <td style="color:var(--text-secondary); font-size:0.82rem">${escapeHtml(p.operario_area || '--')} · ${escapeHtml(p.operario_turno ? p.operario_turno.charAt(0).toUpperCase() + p.operario_turno.slice(1) : '--')}</td>
        <td><div class="emp-actions"><button class="emp-actions__edit" data-id="${p.id}">Editar</button><button class="emp-actions__deactivate" data-id="${p.id}">Quitar</button></div></td>
      </tr>
    `).join('');
}

// Al crear se ofrecen sólo los operarios que todavía no tienen configuración
// particular; al editar, el operario queda fijo (para cambiarlo, se quita y se crea otra).
function poblarOperarios(idSeleccionado = null) {
  const ocupados = new Set(particulares.map((p) => String(p.id_operario)));
  const opciones = idSeleccionado
    ? operarios.filter((o) => String(o.id) === String(idSeleccionado))
    : operarios.filter((o) => !ocupados.has(String(o.id)));
  pOperario.innerHTML = `<option value="">${opciones.length ? 'Escribí el nombre o legajo del operario...' : 'No hay operarios disponibles'}</option>`
    + opciones.map((o) => `<option value="${o.id}">${escapeHtml(nombreOperario(o))} - ${escapeHtml(o.legajo || `ID-${o.id}`)}</option>`).join('');
  pOperario.value = idSeleccionado ? String(idSeleccionado) : '';
  pOperario.disabled = Boolean(idSeleccionado);
  pOperario.dispatchEvent(new Event('change'));
}

async function abrirModalParticular(id = null) {
  if (!operarios.length) {
    try { await cargarOperarios(); } catch (error) { alert(`No se pudieron cargar los operarios: ${error.message}`); return; }
  }
  editandoParticularId = id;
  const p = id ? particulares.find((x) => String(x.id) === String(id)) : null;

  particularModalTitle.textContent = p ? 'Editar configuración particular' : 'Nueva configuración particular';
  poblarOperarios(p?.id_operario);
  // Una nueva configuración arranca con los valores globales actuales, como referencia.
  input('pFcFatiga').value = p?.fc_fatiga ?? input('fcFatiga').value;
  input('pFcSobreesfuerzo').value = p?.fc_sobreesfuerzo ?? input('fcSobreesfuerzo').value;
  pHint.textContent = `Umbral general: fatiga ${input('fcFatiga').value} BPM · sobreesfuerzo ${input('fcSobreesfuerzo').value} BPM.`;

  particularModalOverlay.classList.add('modal-overlay--visible');
  setTimeout(() => (document.getElementById('pOperarioAutocomplete') && !p ? document.getElementById('pOperarioAutocomplete') : input('pFcFatiga')).focus(), 50);
}

function cerrarModalParticular() {
  particularModalOverlay.classList.remove('modal-overlay--visible');
  editandoParticularId = null;
}

async function guardarParticular() {
  const idOperario = Number(pOperario.value);
  const fcFatiga = Number(input('pFcFatiga').value);
  const fcSobreesfuerzo = Number(input('pFcSobreesfuerzo').value);

  if (!idOperario) { alert('Elegí un operario de la lista.'); return; }
  if (![fcFatiga, fcSobreesfuerzo].every((v) => Number.isInteger(v) && v >= 30 && v <= 250)) {
    alert('Las frecuencias deben ser números enteros entre 30 y 250 BPM.'); return;
  }

  try {
    particularModalSave.disabled = true;
    await apiFetch(editandoParticularId ? `/umbrales-operario/${editandoParticularId}` : '/umbrales-operario', {
      method: editandoParticularId ? 'PUT' : 'POST',
      body: JSON.stringify({ idOperario, fcFatiga, fcSobreesfuerzo }),
    });
    cerrarModalParticular();
    await cargarParticulares();
  } catch (error) {
    alert(error.message);
  } finally {
    particularModalSave.disabled = false;
  }
}

async function quitarParticular(id) {
  const p = particulares.find((x) => String(x.id) === String(id));
  const nombre = p ? nombreOperario({ id: p.id_operario, nombre: p.operario_nombre, apellido: p.operario_apellido }) : 'este operario';
  if (!window.confirm(`¿Quitar la configuración particular de ${nombre}? Va a volver a usar los umbrales generales.`)) return;
  try {
    await apiFetch(`/umbrales-operario/${id}`, { method: 'DELETE' });
    await cargarParticulares();
  } catch (error) {
    alert(error.message);
  }
}

particularTableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.emp-actions__edit');
  if (editBtn) { abrirModalParticular(editBtn.dataset.id); return; }
  const quitarBtn = e.target.closest('.emp-actions__deactivate');
  if (quitarBtn) quitarParticular(quitarBtn.dataset.id);
});
btnNuevaParticular.addEventListener('click', () => abrirModalParticular());
particularModalClose.addEventListener('click', cerrarModalParticular);
particularModalCancel.addEventListener('click', cerrarModalParticular);
particularModalOverlay.addEventListener('click', (e) => { if (e.target === particularModalOverlay) cerrarModalParticular(); });
particularModalSave.addEventListener('click', guardarParticular);

cargarConfiguracion().catch((error) => alert(`No se pudo cargar la configuración: ${error.message}`));
cargarParticulares().catch((error) => alert(`No se pudieron cargar las configuraciones particulares: ${error.message}`));
cargarOperarios().catch((error) => console.error(error));
