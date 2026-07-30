const NOTIFICACIONES_API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const NOTIFICACIONES_POLL_INTERVAL_MS = 20000;

function notificacionesApiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'InicioSesion.html';
    return Promise.resolve(null);
  }

  return fetch(`${NOTIFICACIONES_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userIdEmpresa');
        sessionStorage.removeItem('userEmail');
        sessionStorage.removeItem('userName');
        window.location.href = 'InicioSesion.html';
        return null;
      }
      throw new Error(payload.error || payload.message || 'No se pudo completar la operación.');
    }

    return payload;
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapNotificationType(prioridad = '') {
  const normalized = String(prioridad).toLowerCase();
  return normalized.includes('crít') || normalized.includes('crit') ? 'critico' : 'advertencia';
}

function formatNotificationSummary(item) {
  const nombre = `${item.operario_nombre || ''} ${item.operario_apellido || ''}`.trim() || 'Sin operario asignado';
  const area = item.operario_area ? ` · ${item.operario_area}` : '';
  const fechaBase = item.fecha_envio || item.fecha_hora;
  const fecha = fechaBase ? new Date(fechaBase).toLocaleString('es-AR') : 'Fecha no disponible';
  return { nombre, area, fecha };
}

function buildNotificationSubtitle(item) {
  const summary = formatNotificationSummary(item);
  return `${summary.nombre}${summary.area}`;
}

function buildNotificationMeta(item) {
  const summary = formatNotificationSummary(item);
  return `${summary.fecha}`;
}

function renderNotificationsPage(config = {}) {
  const notifList = document.getElementById('notifList');
  const notifCount = document.getElementById('notifCount');
  const btnLeerTodas = document.getElementById('btnLeerTodas');
  const btnActualizar = document.getElementById('btnActualizar');
  const badge = document.getElementById('notifBadge');
  const state = { items: [] };

  async function load() {
    const payload = await notificacionesApiFetch('/notificaciones');
    state.items = (payload?.data || []).map((item) => ({
      id: item.id,
      tipo: mapNotificationType(item.prioridad || ''),
      titulo: item.nombre || 'Alerta',
      subtitulo: buildNotificationSubtitle(item),
      meta: buildNotificationMeta(item),
      prioridad: item.prioridad || 'Advertencia',
      area: item.operario_area || '',
      descripcion: item.descripcion || `${item.operario_nombre || ''} ${item.operario_apellido || ''}`.trim() || 'Sin operario asignado',
      leido: Boolean(item.leida),
    }));
    render();
  }

  function updateCounters() {
    const unread = state.items.filter((item) => !item.leido).length;
    if (notifCount) {
      notifCount.textContent = unread > 0 ? `${unread} sin leer` : 'Todas leídas';
    }
    if (badge) {
      badge.textContent = String(unread);
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
  }

  function render() {
    if (!notifList) return;

    updateCounters();

    if (state.items.length === 0) {
      notifList.innerHTML = '<div class="notif-empty"><div class="notif-empty__title">Sin notificaciones</div><div class="notif-empty__desc">No hay alertas para mostrar en este momento.</div></div>';
      return;
    }

    notifList.innerHTML = state.items.map((item) => `
      <button class="notif-card notif-card--${item.tipo} ${item.leido ? 'notif-card--leido' : ''}" type="button" data-notif-id="${item.id}">
        <div class="notif-card__icon" aria-hidden="true">
          ${item.tipo === 'critico'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l10 18H2L12 2z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'}
        </div>
        <div class="notif-card__content">
          <div class="notif-card__title-row">
            <div class="notif-card__title">${escapeHtml(item.titulo)}</div>
            <span class="notif-card__pill">${escapeHtml(item.prioridad)}</span>
          </div>
          <div class="notif-card__desc">${escapeHtml(item.descripcion)}</div>
          <div class="notif-card__meta">${escapeHtml(item.subtitulo)}</div>
          <div class="notif-card__time">${escapeHtml(item.meta)}</div>
        </div>
        <span class="notif-card__status ${item.leido ? 'notif-card__status--read' : ''}" aria-hidden="true"></span>
      </button>
    `).join('');

    notifList.querySelectorAll('[data-notif-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.notifId);
        const item = state.items.find((notif) => notif.id === id);
        if (!item) return;

        if (!item.leido) {
          try {
            await notificacionesApiFetch(`/notificaciones/${id}/leida`, { method: 'PATCH' });
            item.leido = true;
            updateCounters();
            button.classList.add('notif-card--leido');
          } catch (error) {
            alert(error.message);
            return;
          }
        }

        const targetPage = config.targetPage || 'Supervisor-Notificaciones.html';
        window.location.href = targetPage;
      });
    });
  }

  btnLeerTodas?.addEventListener('click', async () => {
    const pending = state.items.filter((item) => !item.leido);
    try {
      await Promise.all(pending.map((item) => notificacionesApiFetch(`/notificaciones/${item.id}/leida`, { method: 'PATCH' })));
      pending.forEach((item) => { item.leido = true; });
      updateCounters();
      render();
    } catch (error) {
      alert(error.message);
    }
  });

  btnActualizar?.addEventListener('click', () => load().catch((error) => alert(error.message)));

  load().catch((error) => {
    console.error(error);
    if (notifList) {
      notifList.innerHTML = `
        <div class="notif-empty">
          <div class="notif-empty__title">No se pudieron cargar las notificaciones</div>
          <div class="notif-empty__desc">${escapeHtml(error.message || 'Error inesperado')}</div>
        </div>
      `;
    }
  });
  setInterval(() => load().catch((error) => console.error(error)), NOTIFICACIONES_POLL_INTERVAL_MS);
}
