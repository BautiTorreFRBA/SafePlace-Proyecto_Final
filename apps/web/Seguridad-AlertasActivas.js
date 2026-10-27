const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

// H0015: bandeja "en tiempo cercano al real" — polling simple (no hay
// WebSockets/SSE en el proyecto).
const POLL_INTERVAL_MS = 20000;

const tableBody = document.getElementById('alertTableBody');
const alertCount = document.getElementById('alertCount');
let alertas = [];
const tiposActivos = new Set(['FATIGA', 'INACTIVIDAD_PROLONGADA', 'SOBREESFUERZO', 'EMERGENCIA', 'SUPER_EMERGENCIA']);

const ETIQUETA_TIPO_ALERTA = {
  FATIGA: 'Fatiga',
  SOBREESFUERZO: 'Sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'Inactividad prolongada (wearable desconectado)',
  EMERGENCIA: 'EMERGENCIA',
  SUPER_EMERGENCIA: 'SÚPER EMERGENCIA',
};
const ORDEN_TIPO = { SUPER_EMERGENCIA: 0, EMERGENCIA: 1, SOBREESFUERZO: 2, FATIGA: 3, INACTIVIDAD_PROLONGADA: 4 };
const etiquetaTipo = (t) => ETIQUETA_TIPO_ALERTA[t] || t || 'Alerta';
const motivoTipo = (t) => ({
  FATIGA: 'Frecuencia cardíaca elevada durante un período sostenido.',
  SOBREESFUERZO: 'Frecuencia cardíaca por encima del umbral de sobreesfuerzo.',
  INACTIVIDAD_PROLONGADA: 'No se detectó actividad durante el tiempo configurado.',
  EMERGENCIA: 'Se detectaron condiciones de riesgo simultáneas.',
  SUPER_EMERGENCIA: 'Se detectó una condición de riesgo crítico.',
}[String(t || '').toUpperCase()] || 'La condición de alerta sigue activa.');
const claseTipo = (t) => ({
  FATIGA: 'fatiga',
  SOBREESFUERZO: 'sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'inactividad',
  EMERGENCIA: 'emergencia',
  SUPER_EMERGENCIA: 'super-emergencia',
}[String(t || '').toUpperCase()] || '');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizarAlerta(a) {
  const estado = a.estado || 'Activa';
  const estadoNormalizado = String(estado).toLowerCase();
  return {
    id: a.id,
    tipoAlerta: String(a.tipo_alerta || '').trim().toUpperCase(),
    tipo: etiquetaTipo(a.tipo_alerta),
    motivo: motivoTipo(a.tipo_alerta),
    claseTipo: claseTipo(a.tipo_alerta),
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    idTrabajador: a.id_trabajador ?? null,
    fechaHora: a.fecha_hora,
    ...separarFechaHora(a.fecha_hora),
    estado,
    atendidaPor: `${a.atendida_por || ''}`.trim(),
    // Atendida = el Responsable de Seguridad e Higiene ya hizo su chequeo. Que
    // un supervisor la haya visto (atendidaPor) no alcanza.
    revisada: estadoNormalizado.includes('atend'),
    estadoClase: estadoNormalizado.includes('cerr') || estadoNormalizado.includes('atend') || estadoNormalizado.includes('resuel')
      ? 'cerrada'
      : estadoNormalizado.includes('rev') ? 'enrevision' : 'activo',
  };
}

function separarFechaHora(value) {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return { fecha: '--', hora: '--' };
  return {
    fecha: fmtARFecha(fecha),
    hora: fmtARHora(fecha, { hour: '2-digit', minute: '2-digit' }),
  };
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
    // El backend incluye el detalle de los errores 500 (por ejemplo, una
    // columna faltante). Priorizarlo evita el mensaje genérico del navegador.
    throw new Error(payload.message || payload.error || 'No se pudo completar la operación.');
  }

  return payload;
}

async function cargarAlertas() {
  const payload = await apiFetch('/alertas/activas');
  // Sin columna de prioridad: las emergencias quedan arriba y, dentro de cada tipo, la más reciente primero.
  alertas = (payload.data || []).map(normalizarAlerta).sort((a, b) => (ORDEN_TIPO[a.tipoAlerta] ?? 9) - (ORDEN_TIPO[b.tipoAlerta] ?? 9)
    || new Date(b.fechaHora) - new Date(a.fechaHora));
  actualizarContador();
  renderTabla();
}

// Seguridad separa la bandeja en dos pestañas: "activas" (el Responsable todavía
// no la revisó, aunque un supervisor ya la haya atendido) y "atendidas" (el
// Responsable ya hizo su segundo chequeo).
let pestana = 'pendientes';
const estaAtendida = (a) => a.revisada;
const noCerrada = (a) => !String(a.estado).toLowerCase().includes('cerr');
// La bandeja del supervisor sólo muestra lo que nadie atendió todavía.
const pendienteParaSupervisor = (a) => a.estadoClase !== 'cerrada' && a.atendidaPor === '';

function actualizarContador() {
  if (window.SAFEPLACE_ALERTAS_VIEW === 'tarjetas') {
    const total = alertas.filter(pendienteParaSupervisor).length;
    alertCount.textContent = `${total} ${total === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
    return;
  }
  const vigentes = alertas.filter(noCerrada);
  const atendidas = vigentes.filter(estaAtendida).length;
  const activas = vigentes.length - atendidas;
  document.getElementById('tabCountActivas').textContent = activas;
  document.getElementById('tabCountAtendidas').textContent = atendidas;
  alertCount.textContent = pestana === 'atendidas'
    ? `${atendidas} ${atendidas === 1 ? 'alerta atendida' : 'alertas atendidas'}`
    : `${activas} ${activas === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
}

// Valor de cada columna para buscar, filtrar, ordenar y exportar.
const COLUMNAS = {
  tipo: { titulo: 'Tipo', texto: (a) => a.tipo, orden: (a) => ORDEN_TIPO[a.tipoAlerta] ?? 9 },
  operario: { titulo: 'Operario', texto: (a) => a.empleado, orden: (a) => a.empleado },
  fecha: { titulo: 'Fecha', texto: (a) => a.fecha, orden: (a) => new Date(a.fechaHora).getTime() || 0 },
  hora: { titulo: 'Hora', texto: (a) => a.hora, orden: (a) => a.hora },
  atendida: { titulo: 'Atendida por', texto: (a) => a.atendidaPor || 'Sin atender', orden: (a) => a.atendidaPor || 'Sin atender' },
};
const normalizarTexto = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Cada pestaña recuerda su propio orden y búsqueda.
const nuevaVista = () => ({ orden: null, busqueda: '' });
const vistaPorPestana = { pendientes: nuevaVista(), atendidas: nuevaVista() };

// Alertas de la pestaña actual tras aplicar búsqueda y orden. También
// es lo que se exporta.
function filasVisibles() {
  const vista = vistaPorPestana[pestana];
  const terminos = normalizarTexto(vista.busqueda).split(/\s+/).filter(Boolean);
  const filas = alertas.filter((a) => {
    if (!tiposActivos.has(a.tipoAlerta) || !noCerrada(a)) return false;
    if (pestana === 'atendidas' ? !estaAtendida(a) : estaAtendida(a)) return false;
    if (terminos.length) {
      const pajar = normalizarTexto(Object.values(COLUMNAS).map((c) => c.texto(a)).join(' '));
      if (!terminos.every((t) => pajar.includes(t))) return false;
    }
    return true;
  });
  if (vista.orden) {
    const { orden } = COLUMNAS[vista.orden.col];
    const signo = vista.orden.dir === 'desc' ? -1 : 1;
    filas.sort((x, y) => {
      const vx = orden(x);
      const vy = orden(y);
      return signo * (typeof vx === 'number' ? vx - vy : String(vx).localeCompare(String(vy), 'es', { numeric: true }));
    });
  }
  return filas;
}

function renderTabla() {
  if (window.SAFEPLACE_ALERTAS_VIEW === 'tarjetas') {
    const filtrados = alertas.filter((a) => tiposActivos.has(a.tipoAlerta) && pendienteParaSupervisor(a));
    tableBody.innerHTML = filtrados.length ? filtrados.map((a) => `<button class="supervisor-alert-card supervisor-alert-card--${a.claseTipo}" type="button" onclick="revisarAlerta(${a.id})">
      <span class="supervisor-alert-card__content">
        <span class="supervisor-alert-card__name">${escapeHtml(a.empleado)}</span>
        <span class="supervisor-alert-card__reason">${escapeHtml(a.motivo)}</span>
        <span class="supervisor-alert-card__meta">${escapeHtml(a.tipo)} · ${escapeHtml(a.fecha)} ${escapeHtml(a.hora)}</span>
      </span>
      <span class="supervisor-alert-card__status">Ver alerta</span>
    </button>`).join('') : '<div class="notif-empty"><div class="notif-empty__title">No hay alertas activas</div><div class="notif-empty__desc">No hay situaciones pendientes de atención.</div></div>';
    return;
  }
  const filtrados = filasVisibles();
  tableBody.innerHTML = filtrados.length ? filtrados.map((a) => `<tr>
      <td class="alert-td-tipo"><div class="alert-tipo alert-tipo--${a.claseTipo}"><span class="alert-tipo-dot" aria-hidden="true"></span>${escapeHtml(a.tipo)}</div></td>
      <td class="alert-td-empleado">${escapeHtml(a.empleado)}</td>
      <td class="alert-td-fecha">${escapeHtml(a.fecha)}</td>
      <td class="alert-td-hora">${escapeHtml(a.hora)}</td>
      <td class="alert-td-atendida">${a.atendidaPor ? escapeHtml(a.atendidaPor) : '<span class="alert-action-done">Sin atender</span>'}</td>
      <td class="alert-td-acciones">${a.revisada ? '<span class="alert-action-done">Revisada</span>' : `<div class="alert-actions"><button class="alert-btn alert-btn--revisar" onclick="revisarAlerta(${a.id})">Revisar</button><button class="alert-btn alert-btn--cerrar" onclick="cerrarAlerta(${a.id})">Cerrar</button></div>`}</td>
    </tr>`).join('') : '<tr><td colspan="6" class="alert-empty">No hay alertas para los filtros seleccionados.</td></tr>';
}

async function cambiarEstado(id, estado) {
  try {
    await apiFetch(`/alertas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    await cargarAlertas();
    window.refrescarNotificaciones?.(); // actualiza el contador de la campana
  } catch (error) {
    alert(error.message);
  }
}

// Atender o cerrar una EMERGENCIA / SÚPER EMERGENCIA pide confirmación ("¿Está mejor <operario>?").
const TIPOS_CON_CONFIRMACION = new Set(['EMERGENCIA', 'SUPER_EMERGENCIA']);
async function confirmarSiEmergencia(id, texto) {
  const alerta = alertas.find((a) => String(a.id) === String(id));
  // En la bandeja del supervisor, toda atención requiere la verificación del
  // estado del operario; Seguridad conserva el criterio original para las
  // emergencias.
  if (!alerta || (window.SAFEPLACE_ALERTAS_VIEW !== 'tarjetas' && !TIPOS_CON_CONFIRMACION.has(alerta.tipoAlerta))) return true;
  const nombre = alerta.empleado === '--' ? '' : alerta.empleado;
  const confirmar = window.confirmarAtencion || ((n) => Promise.resolve(window.confirm(`¿Está mejor ${n || 'el operario'}?`)));
  return confirmar(nombre, texto);
}

// Cerrar siempre pide confirmación. En una (súper) emergencia esa confirmación es
// el "¿Está mejor <operario>?", así no se pregunta dos veces.
async function confirmarCierre(id) {
  const alerta = alertas.find((a) => String(a.id) === String(id));
  if (alerta && TIPOS_CON_CONFIRMACION.has(alerta.tipoAlerta)) {
    return confirmarSiEmergencia(id, 'Al confirmar, la alerta se cierra.');
  }
  const titulo = '¿Estás seguro que querés cerrar esta alerta?';
  if (!window.confirmarAccion) return window.confirm(titulo);
  const detalle = alerta ? `${alerta.tipo} · ${alerta.empleado} · ${alerta.fecha} ${alerta.hora}` : '';
  return window.confirmarAccion({ titulo, texto: detalle, ok: 'Confirmar' });
}

window.cerrarAlerta = async (id) => {
  if (await confirmarCierre(id)) await cambiarEstado(id, 'Cerrada');
};

// ── Modal "Revisar": FC del día del empleado ──────────────────────────────
// Mismo gráfico que el "Historial del empleado" del supervisor, acotado al día
// de la alerta, con el momento de la alerta marcado.
const UMBRALES_POR_DEFECTO = { fatiga: 130, sobreesfuerzo: 160 };
const fcModal = document.getElementById('fcModal');
const fcModalSubtitle = document.getElementById('fcModalSubtitle');
const fcModalStats = document.getElementById('fcModalStats');
const fcModalChart = document.getElementById('fcModalChart');
const fcModalAtender = document.getElementById('fcModalAtender');
let umbralesCache = null;
let fcModalAlertaId = null;

// YYYY-MM-DD del día de la alerta en hora argentina (el backend filtra por ese calendario).
const diaAR = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_AR }).format(date);

// Umbral general + configuraciones particulares por operario (mismo criterio
// que el Motor de Reglas: la particular reemplaza sólo las dos FC).
async function obtenerUmbrales(idTrabajador) {
  if (!umbralesCache) {
    const [global, particulares] = await Promise.allSettled([apiFetch('/umbrales'), apiFetch('/umbrales-operario')]);
    const u = global.status === 'fulfilled' ? global.value?.data || {} : {};
    umbralesCache = {
      general: {
        fatiga: Number(u.fc_fatiga) || UMBRALES_POR_DEFECTO.fatiga,
        sobreesfuerzo: Number(u.fc_sobreesfuerzo) || UMBRALES_POR_DEFECTO.sobreesfuerzo,
      },
      particulares: new Map(particulares.status === 'fulfilled'
        ? (particulares.value?.data || []).map((p) => [String(p.id_operario), p])
        : []),
    };
    [global, particulares].filter((r) => r.status === 'rejected').forEach((r) => console.error(r.reason));
  }
  const { general } = umbralesCache;
  const particular = umbralesCache.particulares.get(String(idTrabajador));
  if (!particular) return general;
  return {
    fatiga: particular.fc_fatiga != null ? Number(particular.fc_fatiga) : general.fatiga,
    sobreesfuerzo: particular.fc_sobreesfuerzo != null ? Number(particular.fc_sobreesfuerzo) : general.sobreesfuerzo,
  };
}

function renderStatsFc(puntos) {
  const lecturas = puntos.reduce((acc, p) => acc + p.lecturas, 0);
  const promedio = lecturas
    ? Math.round(puntos.reduce((acc, p) => acc + p.fcPromedio * p.lecturas, 0) / lecturas)
    : null;
  const min = puntos.length ? Math.min(...puntos.map((p) => p.fcMin)) : null;
  const max = puntos.length ? Math.max(...puntos.map((p) => p.fcMax)) : null;
  const stat = (label, valor, unidad = 'BPM') => `<div class="fc-modal__stat"><span>${label}</span><strong>${valor ?? '--'}${unidad && valor != null ? ` <small>${unidad}</small>` : ''}</strong></div>`;
  fcModalStats.innerHTML = stat('Promedio FC', promedio) + stat('Mínimo', min) + stat('Máximo', max) + stat('Lecturas', lecturas, '');
}

// Estado del gráfico: la serie completa del día y la ventana visible [v0, v1]
// (zoom). El eje X es tiempo real, así que el zoom es sólo cambiar esa ventana.
const FC_CHART = { width: 800, height: 280, left: 40, right: 18, top: 18, bottom: 36 };
const FC_PLOT_W = FC_CHART.width - FC_CHART.left - FC_CHART.right;
const FC_ZOOM_MIN_MS = 10 * 60_000; // ventana mínima: 10 minutos
const fcZoom = { puntos: [], umbrales: UMBRALES_POR_DEFECTO, momentoAlerta: null, t0: 0, t1: 0, v0: 0, v1: 0 };
const tsDe = (p) => new Date(p.ts).getTime();
const horaFc = (t) => fmtARHora(new Date(t), { hour: '2-digit', minute: '2-digit' });

function renderGraficoFc(puntos, umbrales, momentoAlerta) {
  fcZoom.puntos = puntos;
  if (!puntos.length) {
    fcModalChart.innerHTML = '<div class="fc-modal__empty">No hay mediciones de frecuencia cardíaca para este operario en el día.</div>';
    return;
  }
  fcZoom.umbrales = umbrales;
  fcZoom.momentoAlerta = momentoAlerta ? new Date(momentoAlerta).getTime() : NaN;
  fcZoom.t0 = tsDe(puntos[0]);
  fcZoom.t1 = Math.max(tsDe(puntos[puntos.length - 1]), fcZoom.t0 + 60_000);
  fcZoom.v0 = fcZoom.t0;
  fcZoom.v1 = fcZoom.t1;

  fcModalChart.innerHTML = `<div class="fc-chart__toolbar">
      <span class="fc-chart__range" id="fcChartRange"></span>
      <span class="fc-chart__hint">Rueda del mouse para hacer zoom · arrastrá para moverte · doble clic para restablecer</span>
      <div class="fc-chart__zoom" role="group" aria-label="Zoom del gráfico">
        <button type="button" data-fc-zoom="out" aria-label="Alejar">−</button>
        <button type="button" data-fc-zoom="in" aria-label="Acercar">+</button>
        <button type="button" data-fc-zoom="reset" aria-label="Restablecer zoom">Restablecer</button>
      </div>
    </div>
    <div class="fc-chart__canvas" id="fcChartCanvas"></div>`;
  dibujarGraficoFc();
}

function dibujarGraficoFc() {
  const canvas = document.getElementById('fcChartCanvas');
  if (!canvas) return;
  const { puntos, umbrales: { fatiga, sobreesfuerzo }, v0, v1, t0, t1 } = fcZoom;
  const { width, height, left, right, top, bottom } = FC_CHART;

  // Puntos visibles + un vecino a cada lado para que la línea llegue al borde.
  const iIni = Math.max(0, puntos.findIndex((p) => tsDe(p) >= v0) - 1);
  let iFin = puntos.length - 1;
  for (let i = puntos.length - 1; i >= 0; i -= 1) { if (tsDe(puntos[i]) <= v1) { iFin = Math.min(puntos.length - 1, i + 1); break; } }
  const tramo = puntos.slice(iIni, iFin + 1);
  const visibles = tramo.filter((p) => tsDe(p) >= v0 && tsDe(p) <= v1);

  // Eje Y ajustado a lo visible: al hacer zoom se ve más detalle de la variación.
  const valores = (visibles.length ? visibles : tramo).map((p) => p.fcPromedio);
  const min = Math.max(30, Math.floor(Math.min(...valores, fatiga) / 10) * 10 - 10);
  const max = Math.min(220, Math.ceil(Math.max(...valores, sobreesfuerzo) / 10) * 10 + 10);
  const x = (t) => left + ((t - v0) / (v1 - v0)) * FC_PLOT_W;
  const y = (v) => height - bottom - ((v - min) / Math.max(max - min, 1)) * (height - top - bottom);

  // Se corta la línea cuando hay más de 5 minutos sin lecturas.
  let linea = '';
  tramo.forEach((p, i) => {
    const salto = i === 0 || tsDe(p) - tsDe(tramo[i - 1]) > 5 * 60_000;
    linea += `${salto ? 'M' : 'L'} ${x(tsDe(p)).toFixed(1)} ${y(p.fcPromedio).toFixed(1)} `;
  });

  const ticksY = Array.from({ length: 5 }, (_, i) => Math.round(min + ((max - min) * i) / 4));
  const ticksX = Array.from({ length: 6 }, (_, i) => v0 + ((v1 - v0) * i) / 5);
  const radio = visibles.length <= 120 ? 3.5 : 2.5;
  const tA = fcZoom.momentoAlerta;
  const marcaAlerta = tA >= v0 && tA <= v1
    ? `<line class="fc-chart__alert" x1="${x(tA)}" x2="${x(tA)}" y1="${top}" y2="${height - bottom}" /><text class="fc-chart__label--alert" x="${x(tA) + 4}" y="${top + 9}">Alerta ${horaFc(tA)}</text>`
    : '';

  canvas.innerHTML = `<svg class="fc-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Frecuencia cardíaca del día">
    <defs><clipPath id="fcChartClip"><rect x="${left}" y="0" width="${FC_PLOT_W}" height="${height}" /></clipPath></defs>
    ${ticksY.map((v) => `<line class="fc-chart__grid" x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}" /><text x="4" y="${y(v) + 4}">${v}</text>`).join('')}
    <line class="fc-chart__threshold" x1="${left}" x2="${width - right}" y1="${y(fatiga)}" y2="${y(fatiga)}" />
    <line class="fc-chart__threshold fc-chart__threshold--critical" x1="${left}" x2="${width - right}" y1="${y(sobreesfuerzo)}" y2="${y(sobreesfuerzo)}" />
    <g clip-path="url(#fcChartClip)">
      ${marcaAlerta}
      <path class="fc-chart__line" d="${linea}" />
      ${visibles.map((p) => `<circle class="fc-chart__point" cx="${x(tsDe(p))}" cy="${y(p.fcPromedio)}" r="${radio}"><title>${p.fcPromedio} BPM · ${horaFc(tsDe(p))} · ${p.lecturas} lectura(s)</title></circle>`).join('')}
    </g>
    ${ticksX.map((t) => `<text class="fc-chart__hour" x="${x(t)}" y="${height - 12}" text-anchor="middle">${horaFc(t)}</text>`).join('')}
    <text class="fc-chart__label--fatigue" x="${left + 5}" y="${y(fatiga) - 5}">Fatiga ${fatiga}</text>
    <text class="fc-chart__label--critical" x="${left + 5}" y="${y(sobreesfuerzo) - 5}">Sobreesfuerzo ${sobreesfuerzo}</text>
  </svg>`;

  const completo = v0 <= t0 && v1 >= t1;
  const minimo = v1 - v0 <= Math.min(FC_ZOOM_MIN_MS, t1 - t0) + 1;
  document.getElementById('fcChartRange').textContent = completo ? 'Día completo' : `${horaFc(v0)} – ${horaFc(v1)}`;
  fcModalChart.querySelector('[data-fc-zoom="in"]').disabled = minimo;
  fcModalChart.querySelector('[data-fc-zoom="out"]').disabled = completo;
  fcModalChart.querySelector('[data-fc-zoom="reset"]').disabled = completo;
}

// Mueve la ventana [inicio, inicio + span] dentro del día sin salirse de los bordes.
function fijarVentanaFc(inicio, span) {
  const total = fcZoom.t1 - fcZoom.t0;
  const s = Math.min(total, Math.max(Math.min(FC_ZOOM_MIN_MS, total), span));
  const v0 = Math.min(fcZoom.t1 - s, Math.max(fcZoom.t0, inicio));
  fcZoom.v0 = v0;
  fcZoom.v1 = v0 + s;
}

function zoomFc(factor, centro = (fcZoom.v0 + fcZoom.v1) / 2) {
  const span = fcZoom.v1 - fcZoom.v0;
  const proporcion = (centro - fcZoom.v0) / span;
  const nuevoSpan = span * factor;
  fijarVentanaFc(centro - proporcion * nuevoSpan, nuevoSpan);
  dibujarGraficoFc();
}

// clientX del mouse → instante en el eje X (el SVG escala con el ancho del modal).
function tiempoEnPuntero(svg, clientX) {
  const rect = svg.getBoundingClientRect();
  const vx = ((clientX - rect.left) / rect.width) * FC_CHART.width;
  const ratio = Math.min(1, Math.max(0, (vx - FC_CHART.left) / FC_PLOT_W));
  return fcZoom.v0 + ratio * (fcZoom.v1 - fcZoom.v0);
}

fcModalChart.addEventListener('click', (event) => {
  const boton = event.target.closest('[data-fc-zoom]');
  if (!boton || !fcZoom.puntos.length) return;
  const accion = boton.dataset.fcZoom;
  if (accion === 'reset') { fcZoom.v0 = fcZoom.t0; fcZoom.v1 = fcZoom.t1; dibujarGraficoFc(); }
  else zoomFc(accion === 'in' ? 0.5 : 2);
});

fcModalChart.addEventListener('wheel', (event) => {
  const svg = event.target.closest('.fc-chart');
  if (!svg || !fcZoom.puntos.length) return;
  event.preventDefault();
  zoomFc(event.deltaY < 0 ? 0.8 : 1.25, tiempoEnPuntero(svg, event.clientX));
}, { passive: false });

fcModalChart.addEventListener('dblclick', (event) => {
  if (!event.target.closest('.fc-chart')) return;
  fcZoom.v0 = fcZoom.t0; fcZoom.v1 = fcZoom.t1;
  dibujarGraficoFc();
});

// Arrastre para desplazarse. El SVG se regenera en cada movimiento, así que el
// arrastre se sigue sobre el contenedor (que es estable) con pointer capture.
let arrastreFc = null;
let frameFc = null;
fcModalChart.addEventListener('pointerdown', (event) => {
  const svg = event.target.closest('.fc-chart');
  if (!svg || event.button !== 0 || !fcZoom.puntos.length) return;
  arrastreFc = { x: event.clientX, ancho: svg.getBoundingClientRect().width, v0: fcZoom.v0, span: fcZoom.v1 - fcZoom.v0, activo: false };
});
fcModalChart.addEventListener('pointermove', (event) => {
  if (!arrastreFc) return;
  // Se captura recién al moverse: capturar en el pointerdown desviaría el
  // doble clic (restablecer) al contenedor en vez del gráfico.
  if (!arrastreFc.activo) {
    if (Math.abs(event.clientX - arrastreFc.x) < 3) return;
    arrastreFc.activo = true;
    fcModalChart.setPointerCapture(event.pointerId);
    fcModalChart.classList.add('is-dragging');
  }
  const dxViewBox = ((event.clientX - arrastreFc.x) / arrastreFc.ancho) * FC_CHART.width;
  fijarVentanaFc(arrastreFc.v0 - (dxViewBox / FC_PLOT_W) * arrastreFc.span, arrastreFc.span);
  if (!frameFc) frameFc = requestAnimationFrame(() => { frameFc = null; dibujarGraficoFc(); });
});
const terminarArrastreFc = () => {
  arrastreFc = null;
  fcModalChart.classList.remove('is-dragging');
};
fcModalChart.addEventListener('pointerup', terminarArrastreFc);
fcModalChart.addEventListener('pointercancel', terminarArrastreFc);

function cerrarModalFc() {
  fcModal.classList.remove('modal-overlay--visible');
  fcModal.setAttribute('aria-hidden', 'true');
  fcModalAlertaId = null;
}

window.revisarAlerta = async (id) => {
  const alerta = alertas.find((a) => a.id === id);
  if (!alerta) return;

  fcModalAlertaId = id;
  fcModalSubtitle.textContent = `${alerta.empleado} · ${alerta.tipo} · ${alerta.fecha} ${alerta.hora}`;
  fcModalStats.innerHTML = '';
  fcModalChart.innerHTML = '<div class="fc-modal__empty">Cargando mediciones del día...</div>';
  fcModal.classList.add('modal-overlay--visible');
  fcModal.setAttribute('aria-hidden', 'false');

  if (alerta.idTrabajador == null) {
    fcModalChart.innerHTML = '<div class="fc-modal__empty">La alerta no tiene un operario asociado.</div>';
    return;
  }

  const fechaAlerta = new Date(alerta.fechaHora);
  const dia = diaAR(Number.isNaN(fechaAlerta.getTime()) ? new Date() : fechaAlerta);
  try {
    const [serie, umbrales] = await Promise.all([
      apiFetch(`/mediciones?desde=${dia}&hasta=${dia}&id_trabajador=${alerta.idTrabajador}&bucket=1m`),
      obtenerUmbrales(alerta.idTrabajador),
    ]);
    if (fcModalAlertaId !== id) return; // se cerró o se abrió otra alerta mientras cargaba
    const puntos = serie?.data || [];
    renderStatsFc(puntos);
    renderGraficoFc(puntos, umbrales, alerta.fechaHora);
  } catch (error) {
    if (fcModalAlertaId !== id) return;
    fcModalChart.innerHTML = `<div class="fc-modal__empty">${escapeHtml(error.message)}</div>`;
  }
};

fcModal.addEventListener('click', (event) => {
  if (event.target === fcModal || event.target.closest('[data-fc-close]')) cerrarModalFc();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && fcModal.classList.contains('modal-overlay--visible')) cerrarModalFc();
});
fcModalAtender.addEventListener('click', async () => {
  const id = fcModalAlertaId;
  if (id == null) return;
  if (!(await confirmarSiEmergencia(id))) return;
  cerrarModalFc();
  await cambiarEstado(id, 'Atendida');
});

// Tocar un tipo deja sólo ese tipo; tocarlo de nuevo (cuando es el único) vuelve a mostrar todos.
const botonesTipo = [...document.querySelectorAll('.alert-type-filter')];
const todosLosTipos = botonesTipo.map((b) => b.dataset.tipo);

function aplicarTipos(tipos) {
  tiposActivos.clear();
  tipos.forEach((t) => tiposActivos.add(t));
  botonesTipo.forEach((b) => {
    const activo = tiposActivos.has(b.dataset.tipo);
    b.classList.toggle('is-active', activo);
    b.setAttribute('aria-pressed', String(activo));
  });
}

// ── Orden, búsqueda y exportación (sólo la tabla de Seguridad) ──
const buscador = document.getElementById('alertSearch');
const encabezadosOrdenables = [...document.querySelectorAll('th[data-sort]')];

// Refleja en los controles el estado guardado de la pestaña activa.
function sincronizarControles() {
  const vista = vistaPorPestana[pestana];
  if (buscador) buscador.value = vista.busqueda;
  encabezadosOrdenables.forEach((th) => {
    const activo = vista.orden?.col === th.dataset.sort;
    th.setAttribute('aria-sort', activo ? (vista.orden.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

encabezadosOrdenables.forEach((th) => th.addEventListener('click', () => {
  const vista = vistaPorPestana[pestana];
  const col = th.dataset.sort;
  // Ascendente → descendente → orden original.
  if (vista.orden?.col !== col) vista.orden = { col, dir: 'asc' };
  else if (vista.orden.dir === 'asc') vista.orden = { col, dir: 'desc' };
  else vista.orden = null;
  sincronizarControles();
  renderTabla();
}));

buscador?.addEventListener('input', () => {
  vistaPorPestana[pestana].busqueda = buscador.value;
  renderTabla();
});

document.getElementById('alertClearFilters')?.addEventListener('click', () => {
  vistaPorPestana[pestana] = nuevaVista();
  aplicarTipos(todosLosTipos);
  sincronizarControles();
  renderTabla();
});

const nombreExportacion = () => (pestana === 'atendidas' ? 'alertas-atendidas' : 'alertas-activas');
const filasParaExportar = () => filasVisibles().map((a) => Object.values(COLUMNAS).map((c) => c.texto(a)));
const encabezadosExportacion = () => Object.values(COLUMNAS).map((c) => c.titulo);

function exportarPDF() {
  if (!window.jspdf?.jsPDF) {
    alert('No se pudo cargar la libreria PDF.');
    return;
  }
  const doc = new window.jspdf.jsPDF('landscape');
  doc.setFontSize(16);
  doc.text(pestana === 'atendidas' ? 'Alertas atendidas' : 'Alertas activas', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el ${fmtAR(new Date())}`, 14, 22);
  doc.autoTable({
    startY: 28,
    head: [encabezadosExportacion()],
    body: filasParaExportar(),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });
  doc.save(`${nombreExportacion()}.pdf`);
}

function exportarExcel() {
  if (!window.XLSX) {
    alert('No se pudo cargar la libreria Excel.');
    return;
  }
  const hoja = window.XLSX.utils.aoa_to_sheet([encabezadosExportacion(), ...filasParaExportar()]);
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, pestana === 'atendidas' ? 'Atendidas' : 'Activas');
  window.XLSX.writeFile(libro, `${nombreExportacion()}.xlsx`);
}

document.getElementById('btnExportPDF')?.addEventListener('click', exportarPDF);
document.getElementById('btnExportExcel')?.addEventListener('click', exportarExcel);

// Cada pestaña consulta otra vez al servidor y restablece los botones de tipo
// que se hubieran aplicado antes; el orden y la búsqueda se conservan por pestaña.
const botonesPestana = [...document.querySelectorAll('.alert-status-filter')];
botonesPestana.forEach((boton) => boton.addEventListener('click', async () => {
  pestana = boton.dataset.filter;
  botonesPestana.forEach((b) => {
    const activo = b === boton;
    b.classList.toggle('is-active', activo);
    b.setAttribute('aria-pressed', String(activo));
  });
  aplicarTipos(todosLosTipos);
  sincronizarControles();

  try {
    await cargarAlertas();
  } catch (error) {
    console.error(error);
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px;">No se pudieron cargar las alertas</td></tr>';
  }
}));

botonesTipo.forEach((button) => {
  button.addEventListener('click', () => {
    const tipo = button.dataset.tipo;
    const soloEste = tiposActivos.size === 1 && tiposActivos.has(tipo);
    aplicarTipos(soloEste ? todosLosTipos : [tipo]);
    renderTabla();
  });
});

cargarAlertas().catch((error) => {
  console.error(error);
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px;">No se pudieron cargar las alertas activas</td></tr>';
});
setInterval(() => cargarAlertas().catch((error) => console.error(error)), POLL_INTERVAL_MS);
