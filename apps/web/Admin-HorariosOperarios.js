const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

const gruposAreaTurno = document.getElementById('gruposAreaTurno');
const AREAS = ['Logística', 'Mantenimiento', 'Producción', 'Prueba'];
const TURNOS = ['mañana', 'tarde', 'noche'];

async function apiFetch(path) {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'InicioSesion.html';
    return null;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudieron cargar los operarios.');
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

function etiquetaTurno(turno) {
  return turno.charAt(0).toUpperCase() + turno.slice(1);
}

function renderGrupos(empleados) {
  const grupos = new Map();
  AREAS.forEach((area) => TURNOS.forEach((turno) => {
    grupos.set(`${area}::${turno}`, { area, turno, empleados: [] });
  }));

  empleados.forEach((empleado) => {
    const area = empleado.depto || empleado.area;
    const turno = String(empleado.turno || '').toLowerCase();
    const grupo = grupos.get(`${area}::${turno}`);
    if (grupo) grupo.empleados.push(empleado);
  });

  gruposAreaTurno.innerHTML = AREAS.map((area) => `
    <section class="area-turno-seccion">
      <h3 class="area-turno-seccion__titulo">${escapeHtml(area)}</h3>
      <div class="area-turno-seccion__turnos">
        ${TURNOS.map((turno) => {
    const grupo = grupos.get(`${area}::${turno}`);
    return `<article class="grupo-area-turno">
          <header class="grupo-area-turno__header">
            <h4>${escapeHtml(etiquetaTurno(turno))}</h4>
            <span>${grupo.empleados.length} operario${grupo.empleados.length !== 1 ? 's' : ''}</span>
          </header>
          <div class="grupo-area-turno__operarios">
            ${grupo.empleados.length === 0
    ? '<span class="grupo-area-turno__vacio">Sin operarios asignados</span>'
    : grupo.empleados
      .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'))
      .map((empleado) => `<div class="grupo-area-turno__operario">
          ${escapeHtml(`${empleado.apellido}, ${empleado.nombre}`)} <small>${escapeHtml(empleado.legajo)}</small>
        </div>`).join('')}
          </div>
        </article>`;
  }).join('')}
      </div>
    </section>`).join('');
}

async function init() {
  try {
    const payload = await apiFetch('/dashboard/employees');
    const empleadosActivos = (payload.data || payload.employees || []).filter((empleado) => empleado.estado);
    renderGrupos(empleadosActivos);
  } catch (error) {
    gruposAreaTurno.innerHTML = `<p class="emp-header__count">${escapeHtml(error.message)}</p>`;
    console.error(error);
  }
}

init();
