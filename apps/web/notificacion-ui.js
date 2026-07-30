const NOTIF_API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const NOTIF_POLL_INTERVAL_MS = 20000;

function notifApiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'InicioSesion.html';
    return Promise.resolve(null);
  }

  return fetch(`${NOTIF_API_BASE_URL}${path}`, {
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapNotifType(prioridad = '') {
  return prioridad.toLowerCase().includes('crít') || prioridad.toLowerCase().includes('crit')
    ? 'critico'
    : 'advertencia';
}

function getNotificationTargetPage() {
  const role = String(sessionStorage.getItem('userRole') || '').toLowerCase();
  if (role === 'seguridad') return 'Seguridad-Notificaciones.html';
  return 'Supervisor-Notificaciones.html';
}

function buildNotifSummary(notif) {
  const person = `${notif.operario_nombre || ''} ${notif.operario_apellido || ''}`.trim() || 'Sin operario asignado';
  const when = notif.fecha_hora ? new Date(notif.fecha_hora).toLocaleString('es-AR') : 'Fecha no disponible';
  return `${person} · ${notif.tipo_alerta || 'Alerta'} · ${when}`;
}

function ensureNotifModal() {
  let modal = document.getElementById('notifModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'notifModal';
  modal.className = 'notif-modal';
  modal.innerHTML = `
    <div class="notif-modal__backdrop" data-notif-close></div>
    <div class="notif-modal__panel" role="dialog" aria-modal="true" aria-labelledby="notifModalTitle">
      <div class="notif-modal__header">
        <div>
          <h3 class="notif-modal__title" id="notifModalTitle">Notificaciones recientes</h3>
          <p class="notif-modal__subtitle">Tocá una notificación para ir al listado completo.</p>
        </div>
        <button class="notif-modal__close" type="button" data-notif-close aria-label="Cerrar">×</button>
      </div>
      <div class="notif-modal__body" id="notifModalBody"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (event) => {
    if (event.target && event.target.matches('[data-notif-close]')) {
      closeNotifModal();
    }
  });

  return modal;
}

function closeNotifModal() {
  const modal = document.getElementById('notifModal');
  if (modal) modal.classList.remove('notif-modal--open');
}

function openNotifModal(notificaciones) {
  const modal = ensureNotifModal();
  const body = document.getElementById('notifModalBody');
  const targetPage = getNotificationTargetPage();
  const items = notificaciones.slice(0, 6);

  body.innerHTML = items.length
    ? items.map((notif) => `
      <button class="notif-preview notif-preview--${mapNotifType(notif.prioridad || '')}" type="button" data-notif-target="${targetPage}">
        <div class="notif-preview__top">
          <strong>${escapeHtml(notif.tipo_alerta || 'Alerta')}</strong>
          <span class="notif-preview__state">${notif.leida ? 'Leída' : 'Nueva'}</span>
        </div>
        <div class="notif-preview__summary">${escapeHtml(buildNotifSummary(notif))}</div>
      </button>
    `).join('')
    : '<div class="notif-preview notif-preview--empty">No hay notificaciones actuales.</div>';

  body.querySelectorAll('[data-notif-target]').forEach((button) => {
    button.addEventListener('click', () => {
      window.location.href = button.dataset.notifTarget;
    });
  });

  modal.classList.add('notif-modal--open');
}

async function loadHomeNotifications() {
  const badge = document.getElementById('notifBadge');
  const bell = document.querySelector('.notif-bell');
  if (!badge || !bell) return;

  const payload = await notifApiFetch('/notificaciones?leida=false');
  const notificaciones = payload?.data || [];

  badge.textContent = String(notificaciones.length);
  badge.style.display = notificaciones.length > 0 ? 'flex' : 'none';
  bell.classList.toggle('notif-bell--has-items', notificaciones.length > 0);

  bell.onclick = () => openNotifModal(notificaciones);
}

function initHomeNotifications() {
  loadHomeNotifications().catch((error) => console.error(error));
  setInterval(() => loadHomeNotifications().catch((error) => console.error(error)), NOTIF_POLL_INTERVAL_MS);
}

initHomeNotifications();
