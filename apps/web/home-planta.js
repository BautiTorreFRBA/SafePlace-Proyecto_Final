const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const POLL_INTERVAL_MS = 15000;
// Mismo límite que el backend (estado.repository): una lectura de más de 5 min se considera desactualizada.
const LIMITE_DESACTUALIZADO_S = 5 * 60;
// Home compartido por Admin, Supervisor y Seguridad e Higiene: cada HTML indica en
// <body data-historial="..."> a qué pantalla de historial llevan las tarjetas (?empleado=<id>).
// El backend ya limita /estado/trabajadores-activos al alcance de cada supervisor.
const HISTORIAL_URL = document.body.dataset.historial || 'Admin-HistorialEmpleado.html';
const HISTORIAL_ORIGEN = document.body.dataset.historialOrigen || '';

function enlaceHistorial(idTrabajador) {
  const parametros = new URLSearchParams({ empleado: String(idTrabajador) });
  if (HISTORIAL_ORIGEN) parametros.set('origen', HISTORIAL_ORIGEN);
  return `${HISTORIAL_URL}?${parametros.toString()}`;
}

// Estado de cada tarjeta → color del dibujo, etiqueta del chip, grupo del filtro y orden.
// Es el único lugar donde se define el mapeo: cambiar un color acá lo cambia en toda la pantalla.
const ESTADOS = {
  super_emergencia: { label: 'Súper emergencia', color: '#ff1a1a', grupo: 'critico', rank: -2 },
  emergencia: { label: 'Emergencia', color: '#ffd60a', grupo: 'critico', rank: -1 },
  sobreesfuerzo: { label: 'Sobreesfuerzo', color: '#a78bfa', grupo: 'critico', rank: 0 },
  fatiga: { label: 'Fatiga', color: '#4ade80', grupo: 'advertencia', rank: 1 },
  inactividad: { label: 'Inactividad prolongada', color: '#38bdf8', grupo: 'advertencia', rank: 2 },
  normal: { label: 'Normal', color: '#e9a9a3', grupo: 'normal', rank: 3 },
  sin_datos: { label: 'Sin datos', color: '#9ca3af', grupo: 'sin_datos', rank: 4 },
};
// Tipo de alerta activa → estado. Si hay varias, gana la de menor rank (SUPER_EMERGENCIA > EMERGENCIA > SOBREESFUERZO > FATIGA > INACTIVIDAD).
const ALERTA_A_ESTADO = { SUPER_EMERGENCIA: 'super_emergencia', EMERGENCIA: 'emergencia', SOBREESFUERZO: 'sobreesfuerzo', FATIGA: 'fatiga', INACTIVIDAD_PROLONGADA: 'inactividad' };

const AVATARES = {
  masculino: 'assets/avatars/avatar-hombre.png',
  femenino: 'assets/avatars/avatar-mujer.png',
  neutro: 'assets/avatars/avatar-neutro.svg',
};

// Turno en curso con la hora de la planta (Argentina), mismas franjas que Gestión de
// Empleados: de 20:00 a 08:00 se toma el turno noche (el último del día).
function turnoActual() {
  const horaAR = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (horaAR >= 8 && horaAR < 12) return 'mañana';
  if (horaAR >= 12 && horaAR < 16) return 'tarde';
  return 'noche';
}

// Qué operarios ve cada rol (el alcance del supervisor ya lo aplica el backend):
// - admin: sólo el turno en curso.
// - supervisor: su área y todos los turnos que tiene a cargo.
// - seguridad: todas las áreas y todos los turnos.
function alcanceDelRol() {
  const rol = String(sessionStorage.getItem('userRole') || '').trim().toLowerCase();
  if (rol === 'supervisor') {
    const area = sessionStorage.getItem('userSupervisorArea') || '';
    let turnos = [];
    try { turnos = JSON.parse(sessionStorage.getItem('userSupervisorTurnos') || '[]'); } catch { turnos = []; }
    turnos = Array.isArray(turnos) ? turnos.map((turno) => String(turno).toLowerCase()) : [];
    return {
      incluye: (item) => Boolean(area) && item.area === area && turnos.includes(String(item.turno || '').toLowerCase()),
      titulo: area ? `Área ${area}` : 'Sin área asignada',
      detalle: turnos.length ? `Turnos a cargo: ${turnos.join(', ')} · los casos prioritarios aparecen primero` : 'No tenés turnos asignados',
    };
  }
  if (rol === 'seguridad') {
    return { incluye: () => true, titulo: 'Todos los turnos', detalle: 'Todas las áreas y turnos · los casos prioritarios aparecen primero' };
  }
  const turno = turnoActual();
  return {
    incluye: (item) => String(item.turno || '').toLowerCase() === turno,
    titulo: `Turno ${turno}`,
    detalle: 'Sólo el turno en curso · los casos prioritarios aparecen primero',
  };
}

let trabajadores = [];
// Las (súper) emergencias se miran aparte: una emergencia es visible para los tres
// roles aunque el operario quede fuera del alcance del rol (otro turno para el Admin,
// otra área/turno para el Supervisor). Ver renderEmergencias().
let emergencias = [];
let alertasActivas = [];
let filtroActual = 'todos';
let busquedaActual = '';

function seleccionarFiltro(filtro) {
  filtroActual = filtro;
  document.querySelectorAll('.supervisor-filter').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.filter === filtro);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function nombreCompleto(item) {
  return `${item.nombre || item.operario_nombre || ''} ${item.apellido || item.operario_apellido || ''}`.trim() || `Operario ${item.id_trabajador ?? ''}`.trim();
}

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  return partes.length ? partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() : 'SP';
}

// "18/9, 12:43 p. m." en hora argentina.
function fechaHora(value) {
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? '' : fmtAR(fecha, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function hora(value) {
  if (!value) return '--:--';
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? '--:--' : fmtARHora(fecha, { hour: '2-digit', minute: '2-digit' });
}

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; throw new Error('Sesión expirada'); }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudo cargar el panel.');
  return payload;
}

function tieneLecturaReciente(item) {
  return item.id_medicion != null && item.segundos_desde_ultima_lectura != null
    && Number(item.segundos_desde_ultima_lectura) <= LIMITE_DESACTUALIZADO_S;
}

// 1) alerta activa (la de mayor prioridad), 2) sin lectura reciente → sin datos,
// 3) FC actual contra sus umbrales (el particular si tiene, si no el global).
function calcularEstado(item, alertasPorTrabajador) {
  const tipos = [...(alertasPorTrabajador.get(String(item.id_trabajador)) || []), item.tipo_alerta];
  const porAlerta = tipos
    .map((tipo) => ALERTA_A_ESTADO[String(tipo || '').toUpperCase()])
    .filter(Boolean)
    .sort((a, b) => ESTADOS[a].rank - ESTADOS[b].rank)[0];
  if (porAlerta) return porAlerta;
  if (!tieneLecturaReciente(item) || item.frecuencia_cardiaca == null) return 'sin_datos';

  const fc = Number(item.frecuencia_cardiaca);
  const sobreesfuerzo = item.fc_sobreesfuerzo_particular ?? item.fc_sobreesfuerzo;
  const fatiga = item.fc_fatiga_particular ?? item.fc_fatiga;
  if (sobreesfuerzo != null && fc >= Number(sobreesfuerzo)) return 'sobreesfuerzo';
  if (fatiga != null && fc >= Number(fatiga)) return 'fatiga';
  return 'normal';
}

function descripcionEstado(item) {
  if (item.estado === 'sin_datos') {
    return item.fecha_hora ? `Última lectura: ${fechaHora(item.fecha_hora)}` : 'Sin datos biométricos disponibles';
  }
  if (item.estado === 'normal') return 'Lecturas dentro de los parámetros';
  if (item.estado === 'inactividad') return 'Inactividad prolongada';
  return `${ESTADOS[item.estado].label}${item.frecuencia_cardiaca != null ? ` · ${item.frecuencia_cardiaca} BPM` : ''}`;
}

function renderSummary() {
  const porGrupo = trabajadores.reduce((acc, item) => { const { grupo } = ESTADOS[item.estado]; acc[grupo] = (acc[grupo] || 0) + 1; return acc; }, {});
  const asignados = trabajadores.filter((item) => item.id_dispositivo != null).length;
  document.getElementById('kpiTrabajadores').textContent = trabajadores.length;
  document.getElementById('kpiAtencion').textContent = (porGrupo.critico || 0) + (porGrupo.advertencia || 0);
  document.getElementById('kpiCritico').textContent = porGrupo.critico || 0;
  document.getElementById('kpiDispositivos').textContent = `${asignados}/${trabajadores.length}`;
  [['Todos', trabajadores.length], ['Critico', porGrupo.critico || 0], ['Advertencia', porGrupo.advertencia || 0], ['Normal', porGrupo.normal || 0], ['SinDatos', porGrupo.sin_datos || 0]]
    .forEach(([key, value]) => { document.getElementById(`filter${key}`).textContent = value; });
}

// SÚPER EMERGENCIA y EMERGENCIA: la tarjeta va envuelta y debajo lleva el botón para atenderla (con
// confirmación). Se resuelve sólo esa alerta; al atender la súper, el backend arrastra la EMERGENCIA
// abierta del mismo operario.
function renderCard(item) {
  const tarjeta = renderTarjeta(item);
  if (item.estado === 'super_emergencia' && item.id_alerta_super != null) {
    return `<div class="op-super">${tarjeta}<button type="button" class="op-super__atender" data-alerta="${escapeHtml(item.id_alerta_super)}">Atender súper emergencia</button></div>`;
  }
  if (item.estado === 'emergencia' && item.id_alerta_emergencia != null) {
    return `<div class="op-super">${tarjeta}<button type="button" class="op-super__atender op-super__atender--emergencia" data-alerta="${escapeHtml(item.id_alerta_emergencia)}">Atender emergencia</button></div>`;
  }
  return tarjeta;
}

function renderTarjeta(item) {
  const config = ESTADOS[item.estado];
  const nombre = nombreCompleto(item);
  const avatar = AVATARES[String(item.sexo || '').toLowerCase()] || AVATARES.neutro;
  const reciente = tieneLecturaReciente(item) && item.frecuencia_cardiaca != null;
  // Si la tarjeta corresponde a un operario fuera del alcance del rol (sólo pasa en la
  // sección de emergencias) se agrega el turno para que se entienda de dónde sale.
  const turnoTexto = item.turno ? etiquetaTurno(turnoDe(item)) : '';
  const ubicacion = [item.area, item.fuera_de_alcance ? turnoTexto : ''].filter(Boolean).join(' · ');
  const subtitulo = [item.legajo, ubicacion].filter(Boolean).join(' · ') || 'Operario';
  // Se conserva el valor de FC, pero sin el ícono de corazón. La foto/avatar
  // del empleado se muestra siempre, aun cuando esté transmitiendo.
  const lectura = `<div class="op-card__fc${reciente ? '' : ' op-card__fc--vacia'}"><strong>${reciente ? escapeHtml(item.frecuencia_cardiaca) : '—'}</strong></div>`;

  const innerEl = `<div class="op-avatar" style="-webkit-mask-image:url('${avatar}');mask-image:url('${avatar}')"><img src="${avatar}" alt="Foto de ${escapeHtml(nombre)}" /></div>`;
  return `<a class="op-card${item.estado === 'normal' ? ' op-card--normal' : ''}${item.estado === 'emergencia' ? ' op-card--emergencia' : ''}${item.estado === 'super_emergencia' ? ' op-card--super-emergencia' : ''}" href="${enlaceHistorial(item.id_trabajador)}" style="--estado:${config.color}" aria-label="Ver historial de ${escapeHtml(nombre)}" title="${escapeHtml(subtitulo)}">
    ${innerEl}
    <div class="op-card__lectura">${lectura}</div>
    <div class="op-card__pie">
      <h4 class="op-card__nombre">${escapeHtml(nombre)}</h4>
      ${ubicacion ? `<p class="op-card__area">${escapeHtml(ubicacion)}</p>` : ''}
      <span class="op-chip"><i></i>${escapeHtml(config.label)}</span>
    </div>
  </a>`;
}

// Grupos por área y, dentro de cada área, por turno (como Gestión de Empleados).
// El turno en curso arranca desplegado y el resto plegado; un turno con una (súper)
// emergencia se despliega solo para que no quede escondida. Lo que el usuario
// abre/cierra a mano se recuerda entre refrescos (el polling vuelve a dibujar todo).
const ORDEN_TURNOS = ['mañana', 'tarde', 'noche'];
const turnosAbiertosManual = new Map(); // "área|turno" -> true/false elegido por el usuario
const turnoDe = (item) => String(item.turno || '').trim().toLowerCase() || 'sin turno';
const areaDe = (item) => item.area || 'Sin área';
const ordenTurno = (turno) => (ORDEN_TURNOS.includes(turno) ? ORDEN_TURNOS.indexOf(turno) : ORDEN_TURNOS.length);
const etiquetaTurno = (turno) => turno.charAt(0).toLocaleUpperCase('es') + turno.slice(1);
const plural = (n, singular, pluralTexto = `${singular}s`) => `${n} ${n === 1 ? singular : pluralTexto}`;

function agruparPor(items, clave) {
  return items.reduce((acc, item) => {
    const k = clave(item);
    if (!acc.has(k)) acc.set(k, []);
    acc.get(k).push(item);
    return acc;
  }, new Map());
}

function renderGrupoArea(area, items, actual) {
  const turnos = [...agruparPor(items, turnoDe)].sort(([a], [b]) => ordenTurno(a) - ordenTurno(b));
  return `<section class="area-turno-seccion">
    <h3 class="area-turno-seccion__titulo">${escapeHtml(area)} <small>${plural(items.length, 'operario')}</small></h3>
    <div class="emp-grupos__turnos">
      ${turnos.map(([turno, operarios]) => {
        const clave = `${area}|${turno}`;
        const tieneEmergencia = operarios.some((item) => ['emergencia', 'super_emergencia'].includes(item.estado));
        const abierto = busquedaActual ? true : turnosAbiertosManual.get(clave) ?? (turno === actual || tieneEmergencia);
        const criticos = operarios.filter((item) => ESTADOS[item.estado].grupo === 'critico').length;
        return `<details class="grupo-area-turno" data-clave="${escapeHtml(clave)}"${abierto ? ' open' : ''}>
          <summary class="grupo-area-turno__header">
            <h4>${escapeHtml(etiquetaTurno(turno))}${turno === actual ? ' <span class="grupo-area-turno__actual">Turno actual</span>' : ''}${criticos ? ` <span class="grupo-area-turno__critico">${plural(criticos, 'crítico')}</span>` : ''}</h4>
            <span>${plural(operarios.length, 'operario')}</span>
          </summary>
          <div class="op-grid">${operarios.map(renderCard).join('')}</div>
        </details>`;
      }).join('')}
    </div>
  </section>`;
}

function renderGrid() {
  const grid = document.getElementById('workerGrid');
  const busqueda = busquedaActual.toLocaleLowerCase();
  const filtrados = trabajadores
    .filter((item) => (filtroActual === 'todos' || ESTADOS[item.estado].grupo === filtroActual)
      && (nombreCompleto(item).toLocaleLowerCase().includes(busqueda) || String(item.legajo || '').toLocaleLowerCase().includes(busqueda)))
    .sort((a, b) => ESTADOS[a.estado].rank - ESTADOS[b.estado].rank
      || (Number(b.frecuencia_cardiaca) || 0) - (Number(a.frecuencia_cardiaca) || 0)
      || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  if (!filtrados.length) {
    grid.innerHTML = '<div class="supervisor-empty">No hay operarios que coincidan con el filtro seleccionado.</div>';
    return;
  }
  // En el Home del supervisor las tarjetas se muestran directamente: el área y
  // el turno ya son parte de su alcance, por lo que no se repiten encabezados
  // como "Producción · 6 operarios" o "Noche · Turno actual".
  if (String(sessionStorage.getItem('userRole') || '').trim().toLowerCase() === 'supervisor') {
    grid.classList.remove('op-groups', 'emp-grupos');
    grid.classList.add('op-grid');
    grid.innerHTML = filtrados.map(renderCard).join('');
    return;
  }
  const actual = turnoActual();
  // Clases de Gestión de Empleados (flechita desplegable, "Turno actual"); se ponen
  // acá también por si el HTML en caché todavía no las tiene.
  grid.classList.remove('op-grid');
  grid.classList.add('op-groups', 'emp-grupos');
  grid.innerHTML = [...agruparPor(filtrados, areaDe)]
    .sort(([a], [b]) => (a === 'Sin área') - (b === 'Sin área') || a.localeCompare(b, 'es'))
    .map(([area, items]) => renderGrupoArea(area, items, actual))
    .join('');
}

// Sección fija arriba de todo con los operarios en EMERGENCIA o SÚPER EMERGENCIA
// (súper primero). No depende de filtros ni de la búsqueda; cuando no queda
// ninguna emergencia sin resolver, la sección se quita.
// Importante: se alimenta de `emergencias` (toda la planta) y NO de `trabajadores`
// (el alcance del rol). Una emergencia la tienen que ver los tres roles: el Admin
// aunque sea de otro turno y el Supervisor aunque sea de otra área/turno.
function renderEmergencias() {
  const enEmergencia = [...emergencias]
    .sort((a, b) => ESTADOS[a.estado].rank - ESTADOS[b.estado].rank || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  let seccion = document.getElementById('emergenciasPanel');
  if (!enEmergencia.length) {
    seccion?.remove();
    return;
  }
  if (!seccion) {
    seccion = document.createElement('section');
    seccion.id = 'emergenciasPanel';
    seccion.className = 'supervisor-panel op-emergencias';
    seccion.setAttribute('aria-live', 'assertive');
    seccion.addEventListener('click', atenderDesdeTarjeta);
    document.querySelector('.supervisor-welcome').before(seccion);
  }
  const supers = enEmergencia.filter((item) => item.estado === 'super_emergencia').length;
  const fuera = enEmergencia.filter((item) => item.fuera_de_alcance).length;
  seccion.classList.toggle('op-emergencias--super', supers > 0);
  seccion.innerHTML = `<div class="supervisor-panel__header">
      <div><h3><span class="op-emergencias__dot" aria-hidden="true"></span>Emergencias en curso · ${plural(enEmergencia.length, 'operario')}</h3>
      <p>${supers ? `${plural(supers, 'súper emergencia', 'súper emergencias')} · ` : ''}${fuera ? `${plural(fuera, 'caso', 'casos')} fuera de tu alcance habitual · ` : ''}Atendé cada caso desde su tarjeta. La sección desaparece cuando no quedan emergencias.</p></div>
    </div>
    <div class="op-grid">${enEmergencia.map(renderCard).join('')}</div>`;
}

function renderAlerts() {
  const nombrePorTrabajador = new Map(trabajadores.map((item) => [String(item.id_trabajador), nombreCompleto(item)]));
  const items = alertasActivas
    .map((alerta) => {
      const estado = ALERTA_A_ESTADO[String(alerta.tipo_alerta || '').toUpperCase()];
      // La API de alertas ya incluye la identidad reidentificada. Se prioriza
      // esa fuente para que el nombre siga mostrándose aunque el operario no
      // figure en la lista de estado del turno actual.
      const nombreAlerta = `${alerta.operario_nombre || alerta.nombre || ''} ${alerta.operario_apellido || alerta.apellido || ''}`.trim();
      return {
        ...alerta,
        estado,
        nombre: nombreAlerta || nombrePorTrabajador.get(String(alerta.id_trabajador)) || `Operario ${alerta.id_trabajador ?? ''}`.trim(),
      };
    })
    .filter((item) => item.estado)
    .sort((a, b) => ESTADOS[a.estado].rank - ESTADOS[b.estado].rank);
  document.getElementById('alertList').innerHTML = items.length
    ? items.map((item) => `<div class="supervisor-alert-item supervisor-alert-item--${item.estado}"><span class="status-indicator"></span><div><strong>${escapeHtml(item.nombre)}</strong><span>${escapeHtml(ESTADOS[item.estado].label)}</span></div><time>${escapeHtml(hora(item.fecha_hora))}</time></div>`).join('')
    : '<div class="supervisor-empty supervisor-empty--small">No hay alertas activas.</div>';
}

function renderConnectivity() {
  const offline = trabajadores.filter((item) => item.estado === 'sin_datos');
  document.getElementById('offlineCount').textContent = offline.length;
  document.getElementById('connectivityList').innerHTML = offline.length
    ? offline.map((item) => `<div class="supervisor-connectivity-item"><div class="worker-avatar worker-avatar--small">${escapeHtml(iniciales(nombreCompleto(item)))}</div><div><strong>${escapeHtml(nombreCompleto(item))}</strong><span>${escapeHtml(descripcionEstado(item))}</span></div></div>`).join('')
    : '<div class="supervisor-empty supervisor-empty--small">Todos los operarios tienen lecturas recientes.</div>';
}

function renderAll() {
  renderSummary();
  renderEmergencias();
  renderGrid();
  renderAlerts();
  renderConnectivity();
  document.getElementById('currentDate').textContent = `Actualizado ${fmtARHora(new Date(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

// El alcance del supervisor puede cambiar mientras tiene la sesión abierta: se
// vuelve a pedir al backend antes de filtrar.
async function refrescarAlcanceSupervisor() {
  if (String(sessionStorage.getItem('userRole') || '').trim().toLowerCase() !== 'supervisor') return;
  try {
    const { data } = await apiFetch('/auth/me');
    sessionStorage.setItem('userSupervisorArea', data?.areaSupervisada ?? '');
    sessionStorage.setItem('userSupervisorTurnos', JSON.stringify(data?.turnosSupervisados ?? []));
  } catch { /* si falla, se usa el alcance guardado al iniciar sesión */ }
}

async function cargarHome() {
  try {
    await refrescarAlcanceSupervisor();
    const [estadoResult, alertasResult] = await Promise.allSettled([apiFetch('/estado/trabajadores-activos'), apiFetch('/alertas/activas')]);
    if (estadoResult.status === 'rejected') throw estadoResult.reason;
    if (alertasResult.status === 'rejected') console.error(alertasResult.reason);

    const alertasPorTrabajador = new Map();
    const superPorTrabajador = new Map(); // id_trabajador -> id de su SUPER_EMERGENCIA activa
    const emergenciaPorTrabajador = new Map(); // id_trabajador -> id de su EMERGENCIA activa
    alertasActivas = alertasResult.status === 'fulfilled' ? alertasResult.value?.data || [] : [];
    // El Home sólo representa condiciones todavía activas. El endpoint también
    // devuelve Atendida para la bandeja de Seguridad e Higiene.
    alertasActivas = alertasActivas.filter((alerta) => String(alerta.estado || '').toLowerCase() === 'activa');
    // Una alerta que el supervisor ya atendió sigue Activa para el Responsable de
    // Seguridad e Higiene (falta su chequeo), pero deja de ser pendiente para el supervisor.
    if (['supervisor', 'admin'].includes(String(sessionStorage.getItem('userRole') || '').trim().toLowerCase())) {
      alertasActivas = alertasActivas.filter((alerta) => !String(alerta.atendida_por || '').trim());
    }
    alertasActivas.forEach((alerta) => {
      const clave = String(alerta.id_trabajador);
      if (!alertasPorTrabajador.has(clave)) alertasPorTrabajador.set(clave, []);
      alertasPorTrabajador.get(clave).push(alerta.tipo_alerta);
      const tipo = String(alerta.tipo_alerta || '').toUpperCase();
      if (tipo === 'SUPER_EMERGENCIA' && !superPorTrabajador.has(clave)) superPorTrabajador.set(clave, alerta.id);
      if (tipo === 'EMERGENCIA' && !emergenciaPorTrabajador.has(clave)) emergenciaPorTrabajador.set(clave, alerta.id);
    });

    const alcance = alcanceDelRol();
    const filas = Array.isArray(estadoResult.value?.data) ? estadoResult.value.data : [];
    // Para el supervisor, la alerta que ya atendió deja de marcar al operario (ver arriba).
    if (['supervisor', 'admin'].includes(String(sessionStorage.getItem('userRole') || '').trim().toLowerCase())) {
      filas.forEach((item) => { if (item.alerta_id_usuario_atendio != null) item.tipo_alerta = null; });
    }
    document.getElementById('turnoActual').textContent = alcance.titulo;
    document.getElementById('alcanceDetalle').textContent = alcance.detalle;
    const conEstado = (item) => ({
      ...item,
      estado: calcularEstado(item, alertasPorTrabajador),
      id_alerta_super: superPorTrabajador.get(String(item.id_trabajador)) ?? null,
      id_alerta_emergencia: emergenciaPorTrabajador.get(String(item.id_trabajador)) ?? null,
    });
    // KPIs, grilla, conectividad y listado de alertas: sólo el alcance del rol.
    trabajadores = filas.filter(alcance.incluye).map(conEstado);
    // Emergencias: toda la planta, sin filtrar por turno ni por área. Se marcan las que
    // quedan fuera del alcance para que la tarjeta muestre área y turno.
    const dentroDelAlcance = new Set(trabajadores.map((item) => String(item.id_trabajador)));
    emergencias = filas
      .map(conEstado)
      .filter((item) => ['super_emergencia', 'emergencia'].includes(item.estado))
      .map((item) => ({ ...item, fuera_de_alcance: !dentroDelAlcance.has(String(item.id_trabajador)) }));
    // Red de seguridad: una (súper) emergencia de un operario que /estado/trabajadores-activos
    // no devuelve (por ejemplo, sin asignación de dispositivo vigente) igual tiene que verse.
    const yaListados = new Set(emergencias.map((item) => String(item.id_trabajador)));
    alertasActivas.forEach((alerta) => {
      const estado = ALERTA_A_ESTADO[String(alerta.tipo_alerta || '').toUpperCase()];
      const clave = String(alerta.id_trabajador);
      if (!['super_emergencia', 'emergencia'].includes(estado) || yaListados.has(clave)) return;
      yaListados.add(clave);
      emergencias.push({
        id_trabajador: alerta.id_trabajador,
        nombre: alerta.operario_nombre || alerta.nombre || '',
        apellido: alerta.operario_apellido || alerta.apellido || '',
        area: alerta.area || null,
        turno: alerta.turno || null,
        frecuencia_cardiaca: null,
        estado,
        fuera_de_alcance: true,
        id_alerta_super: superPorTrabajador.get(clave) ?? null,
        id_alerta_emergencia: emergenciaPorTrabajador.get(clave) ?? null,
      });
    });
    // Un estado crítico siempre se prioriza en el Home: activa la vista de
    // críticos para que ningún caso urgente quede oculto entre el resto.
    if (trabajadores.some((item) => ESTADOS[item.estado].grupo === 'critico')) {
      seleccionarFiltro('critico');
    }
    renderAll();
  } catch (error) {
    console.error(error);
    document.getElementById('workerGrid').innerHTML = `<div class="supervisor-empty supervisor-empty--error">${escapeHtml(error.message)}</div>`;
  }
}

document.querySelectorAll('.supervisor-filter').forEach((button) => button.addEventListener('click', () => {
  seleccionarFiltro(button.dataset.filter);
  renderGrid();
}));
// Botón "Atender (súper) emergencia" de las tarjetas: está en la grilla y en la sección de emergencias.
async function atenderDesdeTarjeta(event) {
  const boton = event.target.closest('.op-super__atender');
  if (!boton) return;
  // La tarjeta puede venir de la grilla (alcance del rol) o de la sección de emergencias
  // (toda la planta): se busca en las dos listas.
  const operario = [...trabajadores, ...emergencias].find((item) => [item.id_alerta_super, item.id_alerta_emergencia].some((id) => id != null && String(id) === String(boton.dataset.alerta)));
  const nombre = operario ? nombreCompleto(operario) : '';
  const confirmar = window.confirmarAtencion || ((n) => Promise.resolve(window.confirm(`¿Está mejor ${n || 'el operario'}?`)));
  if (!(await confirmar(nombre))) return;
  boton.disabled = true;
  boton.textContent = 'Atendiendo…';
  try {
    await apiFetch(`/alertas/${boton.dataset.alerta}`, { method: 'PATCH', body: JSON.stringify({ estado: 'Atendida' }) });
    await cargarHome();
  } catch (error) {
    console.error(error);
    boton.disabled = false;
    boton.textContent = 'No se pudo atender · reintentar';
  }
}
document.getElementById('workerGrid').addEventListener('click', atenderDesdeTarjeta);
// Se escucha el clic en el encabezado (no "toggle", que también salta al redibujar
// con el atributo open) para recordar sólo lo que eligió el usuario.
document.getElementById('workerGrid').addEventListener('click', (event) => {
  const header = event.target.closest('.grupo-area-turno__header');
  if (!header || busquedaActual) return;
  const grupo = header.parentElement;
  turnosAbiertosManual.set(grupo.dataset.clave, !grupo.open);
});
document.getElementById('workerSearch').addEventListener('input', (event) => { busquedaActual = event.target.value.trim(); renderGrid(); });

cargarHome();
setInterval(cargarHome, POLL_INTERVAL_MS);
