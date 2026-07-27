const API_BASE_URL = 'http://localhost:8000/api/v1';
const notifList = document.getElementById('notifList');
const notifCount = document.getElementById('notifCount');
const btnLeerTodas = document.getElementById('btnLeerTodas');

let notificaciones = [];

async function cargarNotificaciones() {
  const res = await fetch(`${API_BASE_URL}/dashboard/alerts`);
  const json = await res.json();
  notificaciones = (json.data || []).map((a) => ({
    id: a.id,
    tipo: (a.tipo_alerta || '').toLowerCase().includes('cr') ? 'critico' : 'advertencia',
    titulo: a.tipo_alerta || 'Alerta',
    descripcion: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim(),
    hora: new Date(a.fecha_hora).toLocaleString('es-AR'),
    leido: false,
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

window.marcarComoLeido = (id) => {
  const notif = notificaciones.find((n) => n.id === id);
  if (notif) {
    notif.leido = true;
    actualizarContador();
    renderNotificaciones();
  }
};

btnLeerTodas.addEventListener('click', () => {
  notificaciones.forEach((n) => { n.leido = true; });
  actualizarContador();
  renderNotificaciones();
});

cargarNotificaciones().catch(console.error);
