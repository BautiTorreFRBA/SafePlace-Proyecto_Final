const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'http://localhost:8000/api/v1';

// H0015: "las notificaciones aparecen en el panel operativo... en tiempo
// cercano al real" — no hay WebSockets/SSE en el proyecto, así que se
// resuelve con polling simple.
const POLL_INTERVAL_MS = 20000;

const notifList = document.getElementById('notifList');
const notifCount = document.getElementById('notifCount');
const btnLeerTodas = document.getElementById('btnLeerTodas');
let notificaciones = [];

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

function mapearTipo(prioridad = '') {
  return prioridad.toLowerCase().includes('crít') || prioridad.toLowerCase().includes('crit')
    ? 'critico'
    : 'advertencia';
}

async function cargarNotificaciones() {
  const payload = await apiFetch('/notificaciones');
  notificaciones = (payload.data || []).map((n) => ({
    id: n.id,
    tipo: mapearTipo(n.prioridad || ''),
    titulo: n.tipo_alerta || 'Alerta',
    descripcion: `${n.operario_nombre || ''} ${n.operario_apellido || ''}`.trim() || 'Sin operario asignado',
    hora: new Date(n.fecha_hora).toLocaleString('es-AR'),
    leido: Boolean(n.leida),
  }));
  actualizarContador();
  renderNotificaciones();
}

function actualizarContador() {
  const sinLeer = notificaciones.filter((n) => !n.leido).length;
  notifCount.textContent = sinLeer > 0 ? `${sinLeer} sin leer` : 'Todas leídas';
  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent = sinLeer;
    badge.style.display = sinLeer > 0 ? 'flex' : 'none';
  }
}

function renderNotificaciones() {
  notifList.innerHTML = notificaciones.map((n) => `<div class="notif-card notif-card--${n.tipo} ${n.leido ? 'notif-card--leido' : ''}" onclick="marcarComoLeido(${n.id})"><div class="notif-card__content"><div class="notif-card__title">${n.titulo}</div><div class="notif-card__desc">${n.descripcion}</div><div class="notif-card__time">${n.hora}</div></div></div>`).join('');
}

window.marcarComoLeido = async (id) => {
  const notif = notificaciones.find((n) => n.id === id);
  if (!notif || notif.leido) return;

  try {
    await apiFetch(`/notificaciones/${id}/leida`, { method: 'PATCH' });
    notif.leido = true;
    actualizarContador();
    renderNotificaciones();
  } catch (error) {
    alert(error.message);
  }
};

btnLeerTodas.addEventListener('click', async () => {
  const pendientes = notificaciones.filter((n) => !n.leido);
  try {
    await Promise.all(pendientes.map((n) => apiFetch(`/notificaciones/${n.id}/leida`, { method: 'PATCH' })));
    pendientes.forEach((n) => { n.leido = true; });
    actualizarContador();
    renderNotificaciones();
  } catch (error) {
    alert(error.message);
  }
});

cargarNotificaciones().catch((error) => console.error(error));
setInterval(() => cargarNotificaciones().catch((error) => console.error(error)), POLL_INTERVAL_MS);
