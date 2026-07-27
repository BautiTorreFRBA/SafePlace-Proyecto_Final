const API_BASE_URL = 'http://localhost:8000/api/v1';
const notifList = document.getElementById('notifList');
const notifCount = document.getElementById('notifCount');
const btnLeerTodas = document.getElementById('btnLeerTodas');
const btnActualizar = document.getElementById('btnActualizar');
let notificaciones = [];

function normalizarTexto(texto = '') {
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapearTipo(tipoAlerta = '') {
  const tipo = normalizarTexto(tipoAlerta);
  if (tipo.includes('crit')) return 'critico';
  if (tipo.includes('info')) return 'info';
  return 'advertencia';
}

async function cargarNotificaciones() {
  const res = await fetch(`${API_BASE_URL}/dashboard/alerts`);
  const json = await res.json();
  notificaciones = (json.data || []).map((a) => ({
    id: a.id,
    tipo: mapearTipo(a.tipo_alerta || ''),
    titulo: a.tipo_alerta || 'Alerta',
    descripcion: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || 'Sin operario asignado',
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
  if (!notifList) return;
  notifList.innerHTML = notificaciones.length
    ? notificaciones.map((n) => `<div class="notif-card notif-card--${n.tipo} ${n.leido ? 'notif-card--leido' : ''}" onclick="marcarComoLeido(${n.id})"><div class="notif-card__content"><div class="notif-card__title">${n.titulo}</div><div class="notif-card__desc">${n.descripcion}</div><div class="notif-card__time">${n.hora}</div></div></div>`).join('')
    : '<div class="notif-card"><div class="notif-card__content"><div class="notif-card__title">Sin notificaciones</div><div class="notif-card__desc">No hay alertas para mostrar en este momento.</div></div></div>';
}

window.marcarComoLeido = (id) => {
  const notif = notificaciones.find((n) => n.id === id);
  if (notif) {
    notif.leido = true;
    actualizarContador();
    renderNotificaciones();
  }
};

btnLeerTodas?.addEventListener('click', () => {
  notificaciones.forEach((n) => { n.leido = true; });
  actualizarContador();
  renderNotificaciones();
});

btnActualizar?.addEventListener('click', () => cargarNotificaciones().catch(console.error));

cargarNotificaciones().catch(console.error);
