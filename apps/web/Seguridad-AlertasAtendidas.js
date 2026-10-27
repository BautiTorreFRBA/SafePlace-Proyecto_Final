const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

// H0015: "las notificaciones aparecen en el panel operativo... en tiempo
// cercano al real" — se resuelve con SSE (conectarStreamNotificaciones).
// Este poll es sólo una red de seguridad por si el stream se corta en
// silencio (proxy de Render, sleep del free tier).
const FALLBACK_POLL_INTERVAL_MS = 60000;

const notifList = document.getElementById('notifList');
const notifCount = document.getElementById('notifCount');
let alertas = [];
let tipoSeleccionado = null;

const ETIQUETA_TIPO_ALERTA = {
  FATIGA: 'Fatiga',
  SOBREESFUERZO: 'Sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'Inactividad prolongada',
  EMERGENCIA: 'EMERGENCIA',
  SUPER_EMERGENCIA: 'SÚPER EMERGENCIA',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    throw new Error(payload.error || payload.message || 'No se pudo completar la operación.');
  }

  return payload;
}

function mapearTipo(tipoAlerta = '', prioridad = '') {
  const tipo = String(tipoAlerta).trim().toUpperCase();
  if (tipo === 'INACTIVIDAD_PROLONGADA') return 'inactividad';
  if (tipo === 'FATIGA') return 'fatiga';
  if (tipo === 'SOBREESFUERZO') return 'sobreesfuerzo';
  if (tipo === 'EMERGENCIA') return 'emergencia';
  if (tipo === 'SUPER_EMERGENCIA') return 'super-emergencia';
  return prioridad.toLowerCase().includes('crít') || prioridad.toLowerCase().includes('crit')
    ? 'critico'
    : 'advertencia';
}

// Alertas que el Responsable ya atendió (las pendientes están en Alertas Activas).
async function cargarAlertas() {
  const payload = await apiFetch('/alertas/activas');
  alertas = (payload.data || []).filter((a) => String(a.estado).toLowerCase() === 'atendida').map((a) => {
    const tipoAlerta = String(a.tipo_alerta || '').trim().toUpperCase();
    return {
      id: a.id,
      tipoAlerta,
      tipo: mapearTipo(a.tipo_alerta, a.prioridad || ''),
      titulo: ETIQUETA_TIPO_ALERTA[tipoAlerta] || a.tipo_alerta || 'Alerta',
      descripcion: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || 'Sin operario asignado',
      hora: fmtAR(new Date(a.fecha_hora)),
      fechaHora: new Date(a.fecha_hora).getTime() || 0,
      atendidaPor: String(a.atendida_por || '').trim(),
    };
  });
  actualizarContador();
  renderAlertas();
}

function actualizarContador() {
  const total = alertas.length;
  notifCount.textContent = `${total} ${total === 1 ? 'alerta atendida' : 'alertas atendidas'}`;
  window.refrescarNotificaciones?.();
}

function renderAlertas() {
  if (!notifList) return;
  const visibles = alertas
    .filter((a) => !tipoSeleccionado || a.tipoAlerta === tipoSeleccionado)
    .sort((x, y) => y.fechaHora - x.fechaHora);
  notifList.innerHTML = visibles.length
    ? visibles.map((a) => `<div class="notif-card notif-card--${a.tipo}" role="article"><div class="notif-card__content"><div class="notif-card__title">${escapeHtml(a.titulo)}</div><div class="notif-card__desc">${escapeHtml(a.descripcion)}</div>${a.atendidaPor ? `<div class="notif-card__area">Atendida por ${escapeHtml(a.atendidaPor)}</div>` : ''}<div class="notif-card__time">${escapeHtml(a.hora)}</div></div></div>`).join('')
    : `<div class="notif-empty"><div class="notif-empty__title">No hay alertas atendidas</div><div class="notif-empty__desc">Probá con otro filtro para ver más alertas.</div></div>`;
}

document.querySelectorAll('.notif-type-filter').forEach((button) => {
  button.addEventListener('click', () => {
    const tipo = button.dataset.tipo;
    tipoSeleccionado = tipoSeleccionado === tipo ? null : tipo;
    document.querySelectorAll('.notif-type-filter').forEach((item) => {
      const activo = item.dataset.tipo === tipoSeleccionado;
      item.classList.toggle('is-active', activo);
      item.setAttribute('aria-pressed', String(activo));
    });
    renderAlertas();
  });
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
          // Cada alerta nueva emite un evento: se recarga la lista de alertas.
          if (bloque.includes('event: notificacion')) {
            cargarAlertas().catch((error) => console.error(error));
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

cargarAlertas().catch((error) => console.error(error));
conectarStreamNotificaciones();
setInterval(() => cargarAlertas().catch((error) => console.error(error)), FALLBACK_POLL_INTERVAL_MS);
