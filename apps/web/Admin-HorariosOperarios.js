const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

const DIAS = [
  { n: 1, label: 'Lunes' },
  { n: 2, label: 'Martes' },
  { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' },
  { n: 5, label: 'Viernes' },
  { n: 6, label: 'Sábado' },
  { n: 7, label: 'Domingo' },
];

const operarioSelect = document.getElementById('operarioSelect');
const horarioBody = document.getElementById('horarioBody');
const btnGuardar = document.getElementById('btnGuardar');
const infoLine = document.getElementById('infoLine');

let trabajos = [];
// Estado en memoria: día (1-7) -> lista de ventanas { horaInicio, horaFin, idTrabajo }.
// Varias ventanas por día están permitidas (turnos partidos, distinto
// trabajo a la mañana y a la tarde) — un día sin ventanas queda inactivo.
let horarioState = {};

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

function opcionesTrabajo(idSeleccionado) {
  const opciones = trabajos.map((t) => `<option value="${t.id}" ${String(t.id) === String(idSeleccionado) ? 'selected' : ''}>${t.nombre}</option>`).join('');
  return `<option value="">Global</option>${opciones}`;
}

function filaVentana(dia, idx, ventana) {
  return `<tr data-dia="${dia}" data-idx="${idx}">
    <td>${idx === 0 ? DIAS.find((d) => d.n === dia).label : ''}</td>
    <td><input class="modal__input ho-inicio" type="time" value="${ventana.horaInicio}" /></td>
    <td><input class="modal__input ho-fin" type="time" value="${ventana.horaFin}" /></td>
    <td><select class="modal__input ho-trabajo">${opcionesTrabajo(ventana.idTrabajo)}</select></td>
    <td><button class="emp-actions__deactivate ho-quitar" type="button">Quitar</button></td>
  </tr>`;
}

function filaAgregar(dia) {
  return `<tr data-dia-agregar="${dia}">
    <td colspan="4"></td>
    <td><button class="emp-actions__edit ho-agregar" type="button">+ Agregar horario</button></td>
  </tr>`;
}

function renderFilas() {
  horarioBody.innerHTML = DIAS.map((d) => {
    const ventanas = horarioState[d.n] || [];
    const filas = ventanas.length === 0
      ? `<tr data-dia="${d.n}"><td>${d.label}</td><td colspan="3" style="color:var(--text-muted)">Sin horario asignado</td><td></td></tr>`
      : ventanas.map((v, idx) => filaVentana(d.n, idx, v)).join('');
    return filas + filaAgregar(d.n);
  }).join('');
}

horarioBody.addEventListener('click', (e) => {
  const btnAgregar = e.target.closest('.ho-agregar');
  if (btnAgregar) {
    const dia = Number(btnAgregar.closest('tr').dataset.diaAgregar);
    horarioState[dia] = horarioState[dia] || [];
    horarioState[dia].push({ horaInicio: '08:00', horaFin: '17:00', idTrabajo: null });
    renderFilas();
    return;
  }

  const btnQuitar = e.target.closest('.ho-quitar');
  if (btnQuitar) {
    const tr = btnQuitar.closest('tr');
    const dia = Number(tr.dataset.dia);
    const idx = Number(tr.dataset.idx);
    horarioState[dia].splice(idx, 1);
    renderFilas();
  }
});

horarioBody.addEventListener('change', (e) => {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const dia = Number(tr.dataset.dia);
  const idx = Number(tr.dataset.idx);
  const ventana = horarioState[dia][idx];
  if (e.target.classList.contains('ho-inicio')) ventana.horaInicio = e.target.value;
  if (e.target.classList.contains('ho-fin')) ventana.horaFin = e.target.value;
  if (e.target.classList.contains('ho-trabajo')) ventana.idTrabajo = e.target.value ? Number(e.target.value) : null;
});

async function cargarHorario(idOperario) {
  if (!idOperario) {
    horarioState = {};
    horarioBody.innerHTML = '';
    btnGuardar.disabled = true;
    return;
  }
  const payload = await apiFetch(`/trabajadores/${idOperario}/horario`);
  horarioState = {};
  (payload.data || []).forEach((v) => {
    horarioState[v.dia_semana] = horarioState[v.dia_semana] || [];
    horarioState[v.dia_semana].push({
      horaInicio: String(v.hora_inicio).slice(0, 5),
      horaFin: String(v.hora_fin).slice(0, 5),
      idTrabajo: v.id_trabajo,
    });
  });
  renderFilas();
  btnGuardar.disabled = false;
}

async function guardar() {
  const idOperario = operarioSelect.value;
  if (!idOperario) return;

  const ventanas = [];
  for (const [dia, lista] of Object.entries(horarioState)) {
    for (const v of lista) {
      if (!v.horaInicio || !v.horaFin || v.horaFin <= v.horaInicio) {
        const label = DIAS.find((d) => d.n === Number(dia)).label;
        alert(`Revisá un horario del día ${label}: "hasta" debe ser posterior a "desde".`);
        return;
      }
      ventanas.push({ diaSemana: Number(dia), horaInicio: v.horaInicio, horaFin: v.horaFin, idTrabajo: v.idTrabajo });
    }
  }

  try {
    btnGuardar.disabled = true;
    await apiFetch(`/trabajadores/${idOperario}/horario`, {
      method: 'PUT',
      body: JSON.stringify({ ventanas }),
    });
    infoLine.textContent = `Horario guardado (${ventanas.length} ventana(s) en ${Object.keys(horarioState).filter((d) => horarioState[d].length > 0).length} día(s)).`;
  } catch (error) {
    alert(error.message);
  } finally {
    btnGuardar.disabled = false;
  }
}

async function init() {
  try {
    const payloadTrabajos = await apiFetch('/trabajos');
    trabajos = (payloadTrabajos.data || []).filter((t) => t.activo);
  } catch (error) {
    trabajos = [];
    console.error(error);
  }

  try {
    const payload = await apiFetch('/dashboard/employees');
    const empleados = (payload.data || payload.employees || []).filter((e) => e.estado);
    operarioSelect.innerHTML = '<option value="">Seleccioná un operario...</option>'
      + empleados.map((e) => `<option value="${e.id}">${e.apellido}, ${e.nombre} (${e.legajo})</option>`).join('');
  } catch (error) {
    operarioSelect.innerHTML = '<option value="">No se pudieron cargar los operarios</option>';
    console.error(error);
  }
}

operarioSelect.addEventListener('change', () => {
  cargarHorario(operarioSelect.value).catch((e) => { console.error(e); alert(e.message); });
});
btnGuardar.addEventListener('click', guardar);

init();
