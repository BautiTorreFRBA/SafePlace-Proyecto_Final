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

function renderFilas(ventanasPorDia) {
  horarioBody.innerHTML = DIAS.map((d) => {
    const v = ventanasPorDia[d.n];
    const activo = Boolean(v);
    return `<tr data-dia="${d.n}">
      <td>${d.label}</td>
      <td><input type="checkbox" class="ho-activo" ${activo ? 'checked' : ''} /></td>
      <td><input class="modal__input ho-inicio" type="time" value="${activo ? String(v.hora_inicio).slice(0, 5) : '08:00'}" ${activo ? '' : 'disabled'} /></td>
      <td><input class="modal__input ho-fin" type="time" value="${activo ? String(v.hora_fin).slice(0, 5) : '17:00'}" ${activo ? '' : 'disabled'} /></td>
    </tr>`;
  }).join('');

  horarioBody.querySelectorAll('tr').forEach((tr) => {
    const chk = tr.querySelector('.ho-activo');
    chk.addEventListener('change', () => {
      tr.querySelector('.ho-inicio').disabled = !chk.checked;
      tr.querySelector('.ho-fin').disabled = !chk.checked;
    });
  });
}

async function cargarHorario(idOperario) {
  if (!idOperario) {
    horarioBody.innerHTML = '';
    btnGuardar.disabled = true;
    return;
  }
  const payload = await apiFetch(`/trabajadores/${idOperario}/horario`);
  const porDia = {};
  (payload.data || []).forEach((v) => { porDia[v.dia_semana] = v; });
  renderFilas(porDia);
  btnGuardar.disabled = false;
}

async function guardar() {
  const idOperario = operarioSelect.value;
  if (!idOperario) return;

  const ventanas = [];
  for (const tr of horarioBody.querySelectorAll('tr')) {
    if (!tr.querySelector('.ho-activo').checked) continue;
    const horaInicio = tr.querySelector('.ho-inicio').value;
    const horaFin = tr.querySelector('.ho-fin').value;
    if (!horaInicio || !horaFin || horaFin <= horaInicio) {
      alert(`Revisá el horario del día ${tr.dataset.dia}: "hasta" debe ser posterior a "desde".`);
      return;
    }
    ventanas.push({ diaSemana: Number(tr.dataset.dia), horaInicio, horaFin });
  }

  try {
    btnGuardar.disabled = true;
    await apiFetch(`/trabajadores/${idOperario}/horario`, {
      method: 'PUT',
      body: JSON.stringify({ ventanas }),
    });
    infoLine.textContent = `Horario guardado (${ventanas.length} día(s) activos).`;
  } catch (error) {
    alert(error.message);
  } finally {
    btnGuardar.disabled = false;
  }
}

async function init() {
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
