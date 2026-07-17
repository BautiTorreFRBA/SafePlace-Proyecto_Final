/* ────────────────────────────────────────────────────────────
   BASE DE DATOS DE NOTIFICACIONES
   ──────────────────────────────────────────────────────────── */ 
   // 'critico' | 'advertencia' | 'info'
const notificaciones = [
  {
    id: 1,
    tipo: 'critico',          
    titulo: 'Sobresesfuerzo detectado',
    descripcion: 'Laura Rodríguez · FC: 135 BPM',
    hora: '15/12/2024 14:28',
    leido: false,
  },
  {
    id: 2,
    tipo: 'advertencia',
    titulo: 'Fatiga detectada',
    descripcion: 'Ana Martínez · Reducción progresiva de actividad',
    hora: '15/12/2024 14:15',
    leido: false,
  },
  {
    id: 3,
    tipo: 'advertencia',
    titulo: 'Inactividad prolongada',
    descripcion: 'Miguel Torres · Sin movimiento por 30+ min',
    hora: '15/12/2024 13:45',
    leido: false,
  },
  {
    id: 4,
    tipo: 'advertencia',
    titulo: 'Fatiga acumulada',
    descripcion: 'Valentina Díaz · Indicadores de fatiga',
    hora: '15/12/2024 14:00',
    leido: false,
  },
  {
    id: 5,
    tipo: 'info',
    titulo: 'Batería baja',
    descripcion: 'Wearable BLE-SP-004 · 15% batería',
    hora: '15/12/2024 14:25',
    leido: false,
  },
  {
    id: 6,
    tipo: 'info',
    titulo: 'Dispositivo desconectado',
    descripcion: 'BLE-SP-006 perdió conexión',
    hora: '15/12/2024 13:15',
    leido: true,
  },
];

const notifList       = document.getElementById('notifList');
const notifCount      = document.getElementById('notifCount');
const btnLeerTodas    = document.getElementById('btnLeerTodas');

function actualizarContador() {
  const sinLeer = notificaciones.filter(n => !n.leido).length;
  notifCount.textContent = sinLeer > 0 ? `${sinLeer} sin leer` : 'Todas leídas';
  
  // Actualizar badge de la campana en el topbar
  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent = sinLeer;
    badge.style.display = sinLeer > 0 ? 'flex' : 'none';
  }
}

function renderNotificaciones() {
  notifList.innerHTML = notificaciones.map(n => {
    const iconoSVG = n.tipo === 'critico'
      ? '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'
      : n.tipo === 'advertencia'
      ? '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>'
      : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';

    return `
      <div class="notif-card notif-card--${n.tipo} ${n.leido ? 'notif-card--leido' : ''}" onclick="marcarComoLeido(${n.id})">
        <div class="notif-card__icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${iconoSVG}
          </svg>
        </div>
        <div class="notif-card__content">
          <div class="notif-card__title">${n.titulo}</div>
          <div class="notif-card__desc">${n.descripcion}</div>
          <div class="notif-card__time">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${n.hora}
          </div>
        </div>
        <div class="notif-card__unread"></div>
      </div>
    `;
  }).join('');
}

function marcarComoLeido(id) {
  const notif = notificaciones.find(n => n.id === id);
  if (notif) {
    notif.leido = true;
    actualizarContador();
    renderNotificaciones();
  }
}

btnLeerTodas.addEventListener('click', () => {
  notificaciones.forEach(n => n.leido = true);
  actualizarContador();
  renderNotificaciones();
});

actualizarContador();
renderNotificaciones();