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
  };

  return labels[normalizedRole] || 'Usuario';
}

function applySessionUI() {
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
}

applySessionUI();
