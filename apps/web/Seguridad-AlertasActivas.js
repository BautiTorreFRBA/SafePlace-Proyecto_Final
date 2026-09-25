const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

// H0015: bandeja "en tiempo cercano al real" — polling simple (no hay
// WebSockets/SSE en el proyecto).
const POLL_INTERVAL_MS = 20000;

const tableBody = document.getElementById('alertTableBody');
const alertCount = document.getElementById('alertCount');
let alertas = [];
const severidadesActivas = new Set(['critico', 'advertencia']);
const tiposActivos = new Set(['FATIGA', 'INACTIVIDAD_PROLONGADA', 'SOBREESFUERZO']);

const ETIQUETA_TIPO_ALERTA = {
  FATIGA: 'Fatiga',
  SOBREESFUERZO: 'Sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'Inactividad prolongada (wearable desconectado)',
};
const etiquetaTipo = (t) => ETIQUETA_TIPO_ALERTA[t] || t || 'Alerta';
const claseTipo = (t) => ({
  FATIGA: 'fatiga',
  SOBREESFUERZO: 'sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'inactividad',
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
    prioridad: (a.prioridad || '').toLowerCase().includes('cr') ? 'critico' : 'advertencia',
    tipoAlerta: String(a.tipo_alerta || '').trim().toUpperCase(),
    tipo: etiquetaTipo(a.tipo_alerta),
    claseTipo: claseTipo(a.tipo_alerta),
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    idTrabajador: a.id_trabajador ?? null,
    fechaHora: a.fecha_hora,
    ...separarFechaHora(a.fecha_hora),
    estado,
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
    throw new Error(payload.error || payload.message || 'No se pudo completar la operación.');
  }

  return payload;
}

async function cargarAlertas() {
  const payload = await apiFetch('/alertas/activas');
  alertas = (payload.data || []).map(normalizarAlerta).sort((a, b) => {
    const prioridad = { critico: 0, advertencia: 1 };
    return prioridad[a.prioridad] - prioridad[b.prioridad];
  });
  actualizarContador();
  renderTabla();
}

function actualizarContador() {
  const total = alertas.filter((a) => a.estadoClase !== 'cerrada').length;
  alertCount.textContent = `${total} ${total === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
}

function renderTabla() {
  const filtrados = alertas.filter((a) => {
    const coincideSeveridad = severidadesActivas.has(a.prioridad);
    const coincideTipo = tiposActivos.has(a.tipoAlerta);
    const coincideEstado = a.estadoClase !== 'cerrada';
    return coincideSeveridad && coincideTipo && coincideEstado;
  });
  tableBody.innerHTML = filtrados.length ? filtrados.map((a) => `<tr>
      <td class="alert-td-prioridad"><span class="alert-badge-prioridad alert-badge-${a.prioridad}">${a.prioridad === 'critico' ? 'Crítica' : 'Media'}</span></td>
      <td class="alert-td-tipo"><div class="alert-tipo">${escapeHtml(a.tipo)}</div></td>
      <td class="alert-td-empleado">${escapeHtml(a.empleado)}</td>
      <td class="alert-td-fecha">${escapeHtml(a.fecha)}</td>
      <td class="alert-td-hora">${escapeHtml(a.hora)}</td>
      <td class="alert-td-estado"><span class="alert-badge-estado alert-badge-${a.estadoClase}">${escapeHtml(a.estado)}</span></td>
      <td class="alert-td-acciones">${a.estadoClase === 'cerrada' ? '<span class="alert-action-done">Resuelta</span>' : `<div class="alert-actions"><button class="alert-btn alert-btn--revisar" onclick="revisarAlerta(${a.id})">Revisar</button><button class="alert-btn alert-btn--cerrar" onclick="cerrarAlerta(${a.id})">Cerrar</button></div>`}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="alert-empty">No hay alertas para los filtros seleccionados.</td></tr>';
}

async function cambiarEstado(id, estado) {
  try {
    await apiFetch(`/alertas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    await cargarAlertas();
  } catch (error) {
    alert(error.message);
  }
}

window.cerrarAlerta = (id) => cambiarEstado(id, 'Cerrada');

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
    fcModalChart.innerHTML = '<div class="fc-modal__empty">No hay mediciones de frecuencia cardíaca para este empleado en el día.</div>';
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
    fcModalChart.innerHTML = '<div class="fc-modal__empty">La alerta no tiene un empleado asociado.</div>';
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
  cerrarModalFc();
  await cambiarEstado(id, 'Atendida');
});

document.querySelectorAll('.alert-severity-filter').forEach((button) => {
  button.addEventListener('click', () => {
    const severidad = button.dataset.severidad;
    if (severidadesActivas.has(severidad)) {
      severidadesActivas.delete(severidad);
    } else {
      severidadesActivas.add(severidad);
    }
    button.classList.toggle('is-active', severidadesActivas.has(severidad));
    button.setAttribute('aria-pressed', String(severidadesActivas.has(severidad)));
    renderTabla();
  });
});
document.querySelectorAll('.alert-type-filter').forEach((button) => {
  button.addEventListener('click', () => {
    const tipo = button.dataset.tipo;
    if (tiposActivos.has(tipo)) {
      tiposActivos.delete(tipo);
    } else {
      tiposActivos.add(tipo);
    }
    button.classList.toggle('is-active', tiposActivos.has(tipo));
    button.setAttribute('aria-pressed', String(tiposActivos.has(tipo)));
    renderTabla();
  });
});

cargarAlertas().catch((error) => {
  console.error(error);
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px;">No se pudieron cargar las alertas activas</td></tr>';
});
setInterval(() => cargarAlertas().catch((error) => console.error(error)), POLL_INTERVAL_MS);
