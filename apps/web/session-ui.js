// Todas las fechas del backend se muestran en horario de Buenos Aires,
// SIEMPRE — sin esto, toLocaleString usa el reloj/zona del sistema operativo
// de quien mira la pantalla, que no tiene por qué estar en ART (nos pasó:
// una PC mostraba las mediciones ~3h adelantadas). 'es-AR' solo define el
// formato (DD/MM, coma antes de la hora); no fija la zona horaria.
const TIMEZONE_AR = 'America/Argentina/Buenos_Aires';
const THEME_STORAGE_KEY = 'safeplace-theme';

function temaGuardado() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  try { localStorage.setItem(THEME_STORAGE_KEY, tema); } catch { /* almacenamiento no disponible */ }
}

function agregarInterruptorTema() {
  document.querySelectorAll('.sidebar__footer').forEach((footer) => {
    if (footer.querySelector('.theme-switch')) return;
    const control = document.createElement('label');
    control.className = 'theme-switch';
    control.title = 'Modo oscuro a la izquierda · modo claro a la derecha';
    control.innerHTML = '<span aria-hidden="true">☾</span><input type="checkbox" aria-label="Cambiar entre modo oscuro y modo claro"><span class="theme-switch__track" aria-hidden="true"></span><span aria-hidden="true">☀</span>';
    const input = control.querySelector('input');
    input.checked = document.documentElement.dataset.theme === 'light';
    input.addEventListener('change', () => aplicarTema(input.checked ? 'light' : 'dark'));
    footer.insertBefore(control, footer.querySelector('.sidebar__logout'));
  });
}

function fmtAR(date, opts) {
  return date.toLocaleString('es-AR', { timeZone: TIMEZONE_AR, ...opts });
}

function fmtARFecha(date, opts) {
  return date.toLocaleDateString('es-AR', { timeZone: TIMEZONE_AR, ...opts });
}

function fmtARHora(date, opts) {
  return date.toLocaleTimeString('es-AR', { timeZone: TIMEZONE_AR, ...opts });
}

function splitName(fullName) {
  return String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function formatDisplayName(fullName) {
  const parts = splitName(fullName);
  if (parts.length === 0) {
    return 'Usuario';
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getInitials(fullName) {
  const parts = splitName(fullName);

  if (parts.length === 0) {
    return 'SP';
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function getRoleLabel(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();

  const labels = {
    admin: 'Administrador',
    supervisor: 'Supervisor Operativo',
    seguridad: 'Resp. Seguridad e Higiene',
    sin_rol: 'Consulta general',
  };

  if (normalizedRole === 'supervisor') {
    const area = sessionStorage.getItem('userSupervisorArea') || '';
    return area ? `Supervisor del área ${area}` : labels.supervisor;
  }

  return labels[normalizedRole] || 'Usuario';
}

function applySessionUI() {
  aplicarTema(temaGuardado());
  const rawName = sessionStorage.getItem('userName') || '';
  const rawRole = sessionStorage.getItem('userRole') || '';

  const displayName = formatDisplayName(rawName);
  const firstName = splitName(displayName)[0] || 'Usuario';
  const initials = getInitials(displayName);
  const roleLabel = getRoleLabel(rawRole);

  document.querySelectorAll('.sidebar__user-name').forEach((element) => {
    element.textContent = displayName;
  });

  document.querySelectorAll('.sidebar__user-role').forEach((element) => {
    element.textContent = roleLabel;
  });

  document.querySelectorAll('.sidebar__footer .avatar, .topbar__right .avatar').forEach((element) => {
    element.textContent = initials;
  });

  const welcomeTitle = document.querySelector('.welcome .welcome__title');
  if (welcomeTitle) {
    welcomeTitle.textContent = `Bienvenido/a, ${firstName}`;
  }

  // Administración reúne asociación y estado en la misma pantalla de
  // Wearables. Así los menús existentes no duplican accesos mientras las
  // páginas estáticas se actualizan progresivamente.
  const wearableLink = document.querySelector('.sidebar__nav a[href="Admin-AsociarWearable.html"]');
  const estadoDispositivosLink = document.querySelector('.sidebar__nav a[href="Admin-EstadoDispositivos.html"]');
  if (wearableLink) wearableLink.childNodes[wearableLink.childNodes.length - 1].textContent = ' Wearables';
  estadoDispositivosLink?.remove();
  agregarInterruptorTema();
}

applySessionUI();
