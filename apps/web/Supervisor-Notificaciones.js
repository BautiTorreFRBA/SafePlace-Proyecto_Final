const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

// H0015: "las notificaciones aparecen en el panel operativo... en tiempo
// cercano al real" — se resuelve con SSE (conectarStreamNotificaciones).
// Este poll es sólo una red de seguridad por si el stream se corta en
// silencio (proxy de Render, sleep del free tier).
const FALLBACK_POLL_INTERVAL_MS = 60000;

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

// SSE manual con fetch (no EventSource nativo): así se puede mandar el
// header Authorization, que EventSource no soporta.
let streamAbortController = null;

function conectarStreamNotificaciones() {
  streamAbortController?.abort();
  streamAbortController = new AbortController();

  const token = sessionStorage.getItem('authToken');
  if (!token) return;

  fetch(`${API_BASE_URL}/notificaciones/stream`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: streamAbortController.signal,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`No se pudo abrir el stream de notificaciones (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const eventos = buffer.split('\n\n');
        buffer = eventos.pop();

        for (const bloque of eventos) {
          if (bloque.includes('event: notificacion')) {
            cargarNotificaciones().catch((error) => console.error(error));
          }
        }
      }

      throw new Error('Stream de notificaciones cerrado por el servidor.');
    })
    .catch((error) => {
      if (error.name === 'AbortError') return;
      console.error('[notificaciones] Stream SSE interrumpido, reintentando en 3s:', error.message);
      setTimeout(conectarStreamNotificaciones, 3000);
    });
}

cargarNotificaciones().catch((error) => console.error(error));
conectarStreamNotificaciones();
setInterval(() => cargarNotificaciones().catch((error) => console.error(error)), FALLBACK_POLL_INTERVAL_MS);
