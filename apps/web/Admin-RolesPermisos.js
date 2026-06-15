/* ============================================================
   SAFEPLACE – ROLES Y PERMISOS
   ============================================================ */

// Estructura de permisos por rol
// true = activo por defecto, false = desactivado
const ROLES = {
  administrador: {
    Empleados:          { Ver: true,  Crear: true,  Editar: true,  Desactivar: true },
    'Roles y Permisos': { Ver: true,  Editar: true },
    Configuración:      { Ver: true,  Editar: true },
    Dashboard:          { Ver: true },
    Monitoreo:          { Ver: false },
    Alertas:            { Ver: false, Gestionar: false },
    'Historial Alertas':{ Ver: false },
    Mediciones:         { Ver: false },
    Wearables:          { Ver: false },
    Procesamiento:      { Ver: false },
    Notificaciones:     { Ver: false },
  },
  supervisor: {
    Empleados:          { Ver: false, Crear: false, Editar: false, Desactivar: false },
    'Roles y Permisos': { Ver: false, Editar: false },
    Configuración:      { Ver: false, Editar: false },
    Dashboard:          { Ver: true },
    Monitoreo:          { Ver: true },
    Alertas:            { Ver: true,  Gestionar: false },
    'Historial Alertas':{ Ver: false },
    Mediciones:         { Ver: true },
    Wearables:          { Ver: true },
    Procesamiento:      { Ver: true },
    Notificaciones:     { Ver: true },
  },
  seguridad: {
    Empleados:          { Ver: false, Crear: false, Editar: false, Desactivar: false },
    'Roles y Permisos': { Ver: false, Editar: false },
    Configuración:      { Ver: false, Editar: false },
    Dashboard:          { Ver: true },
    Monitoreo:          { Ver: false },
    Alertas:            { Ver: true,  Gestionar: true },
    'Historial Alertas':{ Ver: true },
    Mediciones:         { Ver: false },
    Wearables:          { Ver: false },
    Procesamiento:      { Ver: false },
    Notificaciones:     { Ver: true },
  },
};

// Íconos SVG por módulo
const ICONOS = {
  'Empleados':          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  'Roles y Permisos':   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  'Configuración':      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>`,
  'Dashboard':          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  'Monitoreo':          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  'Alertas':            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  'Historial Alertas':  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  'Mediciones':         `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  'Wearables':          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>`,
  'Procesamiento':      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  'Notificaciones':     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--teal-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
};

// Rol activo actual
let rolActivo = 'administrador';

/* Genera el HTML del grid según el rol seleccionado */
function renderGrid(rol) {
  const modulos = ROLES[rol];
  const grid    = document.getElementById('rolesGrid');

  grid.innerHTML = Object.entries(modulos).map(([modulo, permisos]) => `
    <div class="roles-card">
      <div class="roles-card__header">
        ${ICONOS[modulo] ?? ''}
        ${modulo}
      </div>
      ${Object.entries(permisos).map(([permiso, activo]) => `
        <div class="roles-perm">
          <span>${permiso}</span>
          <label class="toggle">
            <input class="toggle__input" type="checkbox" ${activo ? 'checked' : ''}
              data-rol="${rol}" data-modulo="${modulo}" data-permiso="${permiso}" />
            <span class="toggle__track"></span>
          </label>
        </div>
      `).join('')}
    </div>
  `).join('');
}

/* Cambia el tab activo */
document.getElementById('rolesTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.roles-tab');
  if (!tab) return;

  document.querySelectorAll('.roles-tab').forEach(t => t.classList.remove('roles-tab--active'));
  tab.classList.add('roles-tab--active');

  rolActivo = tab.dataset.rol;
  renderGrid(rolActivo);
});

/* Actualiza el estado del permiso al togglear */
document.getElementById('rolesGrid').addEventListener('change', (e) => {
  const { rol, modulo, permiso } = e.target.dataset;
  ROLES[rol][modulo][permiso] = e.target.checked;
  // En producción: await fetch('/api/roles', { method: 'PUT', body: JSON.stringify(ROLES) })
});

// Init
renderGrid(rolActivo);