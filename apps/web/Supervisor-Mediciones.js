const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const tableBody = document.getElementById('medTableBody');
const medCount = document.getElementById('medCount');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterHasta = document.getElementById('filterHasta');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');
const medValidacion = document.getElementById('medValidacion');

let resumen = [];
let validacionActual = null;
let debounceTimer = null;
let chartFc = null;

// Estado del detalle expandible (acordeón: a lo sumo uno abierto).
let detalleAbierto = null;
let chartDetalle = null;
let detalleBucket = '1m';
let detallePagina = 0;
const DETALLE_PAGE_SIZE = 20;

// Motivos de descarte del Servicio de Validación de Datos (errores.js MOTIVOS).
// SIN_CONSENTIMIENTO no aparece: ese descarte ocurre en memoria y no se audita
// (Ley 25.326 / RNF-09).
const MOTIVOS_VALIDACION = {
  ESTRUCTURA_INVALIDA: 'Estructura del paquete inválida',
  CAMPOS_INCOMPLETOS: 'Campos obligatorios ausentes',
  FUERA_DE_RANGO: 'FC fuera del rango biológico (30–220)',
  DUPLICADO: 'Paquete duplicado',
  DISPOSITIVO_INVALIDO: 'Wearable sin asignación vigente',
  DESCONOCIDO: 'Otro',
};

// Etiqueta corta por tipo de alerta para la columna "Alertas" del resumen.
const ALERTA_LABEL = {
  FATIGA: 'Fatiga',
  SOBREESFUERZO: 'Sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'Inactividad',
};

function getAuthHeaders() {
  const token = sessionStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearMarca(iso) {
  const fecha = new Date(iso);
  if (!iso || Number.isNaN(fecha.getTime())) return null;
  return {
    dia: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    hora: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function rangoMarcas(primeraIso, ultimaIso) {
  const p = formatearMarca(primeraIso);
  const u = formatearMarca(ultimaIso);
  if (!p || !u) return '--';
  if (p.dia === u.dia) return `${p.dia} ${p.hora} – ${u.hora}`;
  return `${p.dia} ${p.hora} – ${u.dia} ${u.hora}`;
}

function tiempoRelativo(segundos) {
  if (segundos === null || segundos === undefined) return '--';
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return 'hace segundos';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

function obtenerFiltros() {
  return {
    desde: filterDesde.value || '',
    hasta: filterHasta.value || '',
    empleado: filterEmpleado.value || '',
  };
}

function actualizarContador(total) {
  medCount.textContent = `${total} ${total === 1 ? 'empleado con datos en el período' : 'empleados en el período'}`;
}

function renderEstadoInicial(mensaje) {
  resumen = [];
  validacionActual = null;
  renderValidacion(null);
  actualizarContador(0);
  tableBody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">
        ${escapeHtml(mensaje)}
      </td>
    </tr>
  `;
}

function estadoFrescura(fila) {
  if (fila.lecturas === 0) {
    return { texto: 'Sin datos', clase: 'badge--neutral' };
  }
  if (fila.segundosDesdeUltima !== null && fila.segundosDesdeUltima <= 300) {
    return { texto: 'Al día', clase: 'badge--normal' };
  }
  return { texto: tiempoRelativo(fila.segundosDesdeUltima), clase: 'badge--neutral' };
}

function celdaCobertura(pct) {
  if (pct === null || pct === undefined) return '<span style="color:var(--text-muted)">--</span>';
  let color = 'var(--red)';
  if (pct >= 90) color = 'var(--green)';
  else if (pct >= 60) color = 'var(--orange)';
  return `<span style="color:${color}; font-weight:600">${pct}%</span>`;
}

function celdaAlertas(porTipo) {
  const entradas = Object.entries(porTipo || {}).filter(([, n]) => n > 0);
  if (entradas.length === 0) return '<span style="color:var(--text-muted)">—</span>';
  const total = entradas.reduce((acc, [, n]) => acc + n, 0);
  const detalle = entradas
    .map(([tipo, n]) => `${ALERTA_LABEL[tipo] || tipo}: ${n}`)
    .join(' · ');
  return `<span class="badge badge--warning" title="${escapeHtml(detalle)}">${total}</span>`;
}

function nombreCompleto(f) {
  return `${f.nombre || ''} ${f.apellido || ''}`.trim() || `ID ${f.idTrabajador}`;
}

function renderTabla() {
  actualizarContador(resumen.length);
  detalleAbierto = null;
  destruirChartDetalle();

  if (resumen.length === 0) {
    renderEstadoInicial('No hay empleados con datos ni wearable asignado en el período');
    return;
  }

  tableBody.innerHTML = resumen.map((f, i) => {
    const nombre = nombreCompleto(f);
    const wearable = f.dispositivo
      ? escapeHtml(`${f.dispositivo.marca || ''} ${f.dispositivo.modelo || ''}`.trim() || `#${f.dispositivo.id}`)
      : '<span style="color:var(--text-muted)">sin asignar</span>';
    const fc = f.lecturas > 0
      ? `<span class="med-fc-value">${f.fcPromedio ?? '--'}</span> <span style="color:var(--text-muted); font-size:0.82rem">/ ${f.fcMin ?? '--'} / ${f.fcMax ?? '--'}</span>`
      : '<span style="color:var(--text-muted)">--</span>';
    const lecturas = f.lecturas > 0
      ? `${f.lecturas} <span style="color:var(--text-muted); font-size:0.82rem">(${f.minutosMonitoreados} min)</span>`
      : '<span style="color:var(--text-muted)">0</span>';
    const est = estadoFrescura(f);
    const expandible = f.lecturas > 0;

    return `
      <tr class="med-row${expandible ? ' med-row--expandible' : ''}" data-idx="${i}">
        <td>
          <div>${expandible ? '<span class="med-row__caret">▸</span> ' : ''}${escapeHtml(nombre)}</div>
          <div style="color:var(--text-muted); font-size:0.78rem">${escapeHtml(f.legajo || '')}${f.area ? ` · ${escapeHtml(f.area)}` : ''}</div>
        </td>
        <td style="color:var(--text-secondary); font-size:0.85rem">${wearable}</td>
        <td>${fc}</td>
        <td style="color:var(--text-secondary)">${lecturas}</td>
        <td>${celdaCobertura(f.coberturaPct)}</td>
        <td style="color:var(--text-muted); font-size:0.82rem">${rangoMarcas(f.primera, f.ultima)}</td>
        <td>${celdaAlertas(f.alertasPorTipo)}</td>
        <td><span class="badge ${est.clase}">${escapeHtml(est.texto)}</span></td>
      </tr>
      <tr class="med-detalle" data-idx="${i}" hidden>
        <td colspan="8">
          <div class="med-detalle__box">
            <div class="med-detalle__toolbar">
              <span>Resolución:</span>
              ${['10s', '1m', '5m'].map((b) => `<button type="button" class="med-bucket-btn${b === detalleBucket ? ' is-active' : ''}" data-bucket="${b}">${b === '10s' ? '10 s' : b === '1m' ? '1 min' : '5 min'}</button>`).join('')}
            </div>
            <div class="med-detalle__chart-wrap"><canvas class="med-detalle__chart" height="180"></canvas></div>
            <div class="med-detalle__tabla"></div>
            <div class="med-detalle__pager"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderValidacion(v) {
  if (!medValidacion) return;

  if (!v) {
    medValidacion.innerHTML = '';
    return;
  }

  const recibidos = v.validas + v.descartesTotal;
  const aceptacion = recibidos > 0 ? Math.round((v.validas / recibidos) * 100) : null;

  const motivos = Object.entries(v.descartesPorMotivo || {})
    .sort((a, b) => b[1] - a[1])
    .map(([codigo, total]) => `
      <li style="display:flex; justify-content:space-between; gap:12px; padding:3px 0; border-bottom:1px solid var(--border, rgba(148,163,184,0.15));">
        <span style="color:var(--text-secondary)">${escapeHtml(MOTIVOS_VALIDACION[codigo] || codigo)}</span>
        <strong>${total}</strong>
      </li>`).join('');

  medValidacion.innerHTML = `
    <div class="card">
      <div class="card__header">
        <span class="card__icon-label">Validación de ingesta · período seleccionado</span>
      </div>
      <div class="card__body" style="display:flex; flex-wrap:wrap; gap:28px; align-items:flex-start;">
        <div>
          <div style="font-size:1.6rem; font-weight:600; color:var(--green)">${v.validas}</div>
          <div style="color:var(--text-muted); font-size:0.8rem">paquetes válidos</div>
        </div>
        <div>
          <div style="font-size:1.6rem; font-weight:600; color:${v.descartesTotal > 0 ? 'var(--red)' : 'var(--text-secondary)'}">${v.descartesTotal}</div>
          <div style="color:var(--text-muted); font-size:0.8rem">descartados por validación</div>
        </div>
        <div>
          <div style="font-size:1.6rem; font-weight:600">${aceptacion === null ? '--' : `${aceptacion}%`}</div>
          <div style="color:var(--text-muted); font-size:0.8rem">tasa de aceptación</div>
        </div>
        ${motivos ? `<ul style="list-style:none; margin:0; padding:0; min-width:240px; flex:1;">${motivos}</ul>` : ''}
      </div>
      ${v.erroresAlmacenamiento > 0
        ? `<div class="card__body" style="color:var(--red); font-size:0.82rem; padding-top:0;">⚠ ${v.erroresAlmacenamiento} error(es) de almacenamiento en el período (no son descartes de validación)</div>`
        : ''}
      ${v.duplicados > 0
        ? `<div class="card__body" style="color:var(--text-muted); font-size:0.82rem; padding-top:0;">${v.duplicados} paquete(s) duplicado(s) deduplicados por el backend (reenvíos del buffer del gateway; no cuentan como rechazo)</div>`
        : ''}
      <div class="card__body" style="color:var(--text-muted); font-size:0.75rem; padding-top:0;">
        Fuente: log_auditoria · Servicio de Validación de Datos (RF-04 / H0008). No se desglosa por empleado: el descarte se audita sin identidad ni biodato (Ley 25.326).
      </div>
    </div>`;
}

function destruirGraficas() {
  if (chartFc && typeof chartFc.destroy === 'function') {
    chartFc.destroy();
  }
  chartFc = null;
  destruirChartDetalle();
}

function actualizarGraficas(filas) {
  destruirGraficas();

  const conFc = filas.filter((f) => f.lecturas > 0 && f.fcPromedio !== null);
  const ctxFc = document.getElementById('chartFrecuencia').getContext('2d');
  chartFc = new Chart(ctxFc, {
    type: 'bar',
    data: {
      labels: conFc.map((f) => `${f.nombre || ''} ${f.apellido || ''}`.trim() || `ID ${f.idTrabajador}`),
      datasets: [{
        label: 'FC promedio (BPM)',
        data: conFc.map((f) => f.fcPromedio),
        backgroundColor: 'rgba(45, 212, 191, 0.35)',
        borderColor: '#2dd4bf',
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const f = conFc[ctx.dataIndex];
              return `mín ${f.fcMin ?? '--'} · máx ${f.fcMax ?? '--'} · ${f.lecturas} lecturas`;
            },
          },
        },
      },
      scales: {
        y: { beginAtZero: false, suggestedMin: 50, suggestedMax: 150 },
      },
    },
  });
}

// ── Detalle expandible (serie temporal + tabla paginada) ──────────────────

function destruirChartDetalle() {
  if (chartDetalle && typeof chartDetalle.destroy === 'function') {
    chartDetalle.destroy();
  }
  chartDetalle = null;
}

function filaDetalle(idx) {
  return tableBody.querySelector(`tr.med-detalle[data-idx="${idx}"]`);
}

async function toggleDetalle(idx) {
  const fila = resumen[idx];
  if (!fila || fila.lecturas === 0) return;

  // Cerrar el que estuviera abierto.
  if (detalleAbierto !== null) {
    const previa = filaDetalle(detalleAbierto);
    if (previa) previa.hidden = true;
    const filaPrev = tableBody.querySelector(`tr.med-row[data-idx="${detalleAbierto}"]`);
    if (filaPrev) filaPrev.classList.remove('is-open');
    destruirChartDetalle();
  }

  if (detalleAbierto === idx) {
    detalleAbierto = null;
    return;
  }

  detalleAbierto = idx;
  detallePagina = 0;
  const detalle = filaDetalle(idx);
  const filaMaestra = tableBody.querySelector(`tr.med-row[data-idx="${idx}"]`);
  if (detalle) detalle.hidden = false;
  if (filaMaestra) filaMaestra.classList.add('is-open');

  await Promise.all([cargarSerieDetalle(idx), cargarTablaDetalle(idx)]);
}

function paramsDetalle(idx, extra = {}) {
  const { desde, hasta } = obtenerFiltros();
  const params = new URLSearchParams({ desde, hasta, empleado: nombreCompleto(resumen[idx]) });
  Object.entries(extra).forEach(([k, v]) => params.set(k, v));
  return params;
}

async function cargarSerieDetalle(idx) {
  const contenedor = filaDetalle(idx);
  if (!contenedor) return;
  const canvas = contenedor.querySelector('.med-detalle__chart');
  if (!canvas) return;

  try {
    const res = await fetch(`${API_BASE_URL}/mediciones?${paramsDetalle(idx, { bucket: detalleBucket })}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error(`serie ${res.status}`);
    const json = await res.json();
    const serie = Array.isArray(json.data) ? json.data : [];

    destruirChartDetalle();
    chartDetalle = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: serie.map((p) => new Date(p.ts).toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        })),
        datasets: [
          {
            label: 'máx', data: serie.map((p) => p.fcMax), borderColor: 'rgba(248,113,113,0.4)',
            borderWidth: 1, pointRadius: 0, fill: false,
          },
          {
            label: 'mín', data: serie.map((p) => p.fcMin), borderColor: 'rgba(96,165,250,0.4)',
            borderWidth: 1, pointRadius: 0, fill: '-1', backgroundColor: 'rgba(45,212,191,0.08)',
          },
          {
            label: 'promedio', data: serie.map((p) => p.fcPromedio), borderColor: '#2dd4bf',
            borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const p = serie[items[0].dataIndex];
                return p ? `${p.lecturas} lecturas en el balde` : '';
              },
            },
          },
        },
        scales: { y: { suggestedMin: 50, suggestedMax: 150 } },
      },
    });
  } catch (error) {
    console.error(error);
    canvas.parentElement.innerHTML = '<div style="color:var(--text-muted); padding:12px; font-size:0.85rem">No se pudo cargar la serie.</div>';
  }
}

async function cargarTablaDetalle(idx) {
  const contenedor = filaDetalle(idx);
  if (!contenedor) return;
  const tablaEl = contenedor.querySelector('.med-detalle__tabla');
  const pagerEl = contenedor.querySelector('.med-detalle__pager');

  try {
    const res = await fetch(`${API_BASE_URL}/mediciones?${paramsDetalle(idx, {
      limit: DETALLE_PAGE_SIZE, offset: detallePagina * DETALLE_PAGE_SIZE,
    })}`, { headers: { ...getAuthHeaders() } });
    if (!res.ok) throw new Error(`detalle ${res.status}`);
    const json = await res.json();
    const rows = Array.isArray(json.data) ? json.data : [];

    tablaEl.innerHTML = `
      <table class="med-detalle__inner">
        <thead><tr><th>FECHA/HORA</th><th>FC</th><th>ACTIVIDAD</th><th>TEMP.</th><th>SPO₂</th></tr></thead>
        <tbody>
          ${rows.map((m) => {
            const d = new Date(m.fecha_hora);
            const fh = Number.isNaN(d.getTime()) ? '--' : d.toLocaleString('es-AR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
            });
            const act = window.MedHelpers
              ? window.MedHelpers.etiquetarActividad(m.actividad).texto
              : (m.actividad ?? '--');
            return `<tr>
              <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(fh)}</td>
              <td>${m.frecuencia_cardiaca ?? '--'}</td>
              <td style="color:var(--text-secondary)">${escapeHtml(act)}</td>
              <td style="color:var(--text-secondary)">${m.temperatura_corporal ?? '--'}</td>
              <td style="color:var(--text-secondary)">${m.spo2 ?? '--'}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:12px">Sin lecturas en esta página</td></tr>'}
        </tbody>
      </table>`;

    pagerEl.innerHTML = `
      <button type="button" class="med-bucket-btn" data-page="prev" ${detallePagina === 0 ? 'disabled' : ''}>‹ Anteriores</button>
      <span style="color:var(--text-muted); font-size:0.82rem">Página ${detallePagina + 1}</span>
      <button type="button" class="med-bucket-btn" data-page="next" ${rows.length < DETALLE_PAGE_SIZE ? 'disabled' : ''}>Siguientes ›</button>`;
  } catch (error) {
    console.error(error);
    tablaEl.innerHTML = '<div style="color:var(--text-muted); padding:12px; font-size:0.85rem">No se pudo cargar el detalle.</div>';
  }
}

tableBody.addEventListener('click', (e) => {
  const bucketBtn = e.target.closest('.med-bucket-btn[data-bucket]');
  if (bucketBtn) {
    detalleBucket = bucketBtn.dataset.bucket;
    const box = bucketBtn.closest('.med-detalle__box');
    box.querySelectorAll('.med-bucket-btn[data-bucket]').forEach((b) => b.classList.toggle('is-active', b === bucketBtn));
    if (detalleAbierto !== null) cargarSerieDetalle(detalleAbierto);
    return;
  }

  const pageBtn = e.target.closest('.med-bucket-btn[data-page]');
  if (pageBtn && !pageBtn.disabled) {
    detallePagina += pageBtn.dataset.page === 'next' ? 1 : -1;
    if (detallePagina < 0) detallePagina = 0;
    if (detalleAbierto !== null) cargarTablaDetalle(detalleAbierto);
    return;
  }

  const fila = e.target.closest('tr.med-row--expandible');
  if (fila) {
    toggleDetalle(Number(fila.dataset.idx)).catch((err) => console.error(err));
  }
});

function renderEmpleadoOptions(filas) {
  const actual = filterEmpleado.value;
  const nombres = Array.from(new Set(
    filas.map((f) => `${f.nombre || ''} ${f.apellido || ''}`.trim()).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  filterEmpleado.innerHTML = '<option value="">Todos</option>' + nombres
    .map((nombre) => `<option value="${escapeHtml(nombre)}">${escapeHtml(nombre)}</option>`)
    .join('');

  if (actual && nombres.includes(actual)) {
    filterEmpleado.value = actual;
  }
}

function obtenerMensajeSinFechas() {
  return 'Selecciona las fechas Desde y Hasta para consultar el resumen por empleado.';
}

// YYYY-MM-DD del día de hoy (formato que espera <input type="date">.value).
function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatearNombreArchivo(fecha = new Date()) {
  return fecha.toISOString().slice(0, 10);
}

async function cargarResumen() {
  const { desde, hasta, empleado } = obtenerFiltros();

  if (!desde || !hasta) {
    renderEstadoInicial(obtenerMensajeSinFechas());
    destruirGraficas();
    return;
  }

  const params = new URLSearchParams();
  params.set('desde', desde);
  params.set('hasta', hasta);
  if (empleado) params.set('empleado', empleado);

  const res = await fetch(`${API_BASE_URL}/mediciones/resumen?${params.toString()}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('No autorizado. Volve a iniciar sesion para ver las mediciones.');
    }
    if (res.status === 403) {
      throw new Error('Tu usuario no tiene permiso para ver el historial de mediciones.');
    }
    throw new Error(`No se pudo cargar el resumen (${res.status})`);
  }

  const json = await res.json();
  resumen = Array.isArray(json.data) ? json.data : [];
  validacionActual = json.validacion || null;

  renderEmpleadoOptions(resumen);
  renderTabla();
  actualizarGraficas(resumen);
  renderValidacion(validacionActual);
}

function programarRecarga() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    cargarResumen().catch((error) => {
      console.error(error);
      medCount.textContent = error.message;
    });
  }, 250);
}

function filasExport() {
  return resumen.map((f) => ({
    Empleado: `${f.nombre || ''} ${f.apellido || ''}`.trim() || `ID ${f.idTrabajador}`,
    Legajo: f.legajo || '',
    Área: f.area || '',
    Wearable: f.dispositivo ? `${f.dispositivo.marca || ''} ${f.dispositivo.modelo || ''}`.trim() : 'sin asignar',
    'FC promedio': f.fcPromedio ?? '',
    'FC mín': f.fcMin ?? '',
    'FC máx': f.fcMax ?? '',
    Lecturas: f.lecturas,
    'Minutos monitoreados': f.minutosMonitoreados,
    'Cobertura %': f.coberturaPct ?? '',
    Primera: f.primera ? new Date(f.primera).toLocaleString('es-AR') : '',
    Última: f.ultima ? new Date(f.ultima).toLocaleString('es-AR') : '',
    Alertas: Object.entries(f.alertasPorTipo || {})
      .filter(([, n]) => n > 0)
      .map(([t, n]) => `${ALERTA_LABEL[t] || t}: ${n}`)
      .join(' · '),
  }));
}

function exportarPDF() {
  if (resumen.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }
  if (!window.jspdf?.jsPDF) {
    alert('No se pudo cargar la libreria PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  doc.setFontSize(16);
  doc.text('Resumen de Mediciones por Empleado', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, 22);

  let tablaInicio = 28;
  if (validacionActual) {
    const v = validacionActual;
    const recibidos = v.validas + v.descartesTotal;
    const pct = recibidos > 0 ? Math.round((v.validas / recibidos) * 100) : null;
    doc.text(
      `Validación de ingesta del período: ${v.validas} válidos · ${v.descartesTotal} descartados`
        + `${pct === null ? '' : ` · ${pct}% aceptación`}`,
      14,
      28,
    );
    tablaInicio = 34;
  }

  const filas = filasExport();
  doc.autoTable({
    startY: tablaInicio,
    head: [['Empleado', 'Legajo', 'Wearable', 'FC prom', 'FC mín', 'FC máx', 'Lecturas', 'Cob. %', 'Primera', 'Última', 'Alertas']],
    body: filas.map((f) => [
      f.Empleado, f.Legajo, f.Wearable, f['FC promedio'], f['FC mín'], f['FC máx'],
      f.Lecturas, f['Cobertura %'], f.Primera, f.Última, f.Alertas,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });

  doc.save(`resumen-mediciones-${formatearNombreArchivo()}.pdf`);
}

function exportarExcel() {
  if (resumen.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }
  if (!window.XLSX) {
    alert('No se pudo cargar la libreria Excel.');
    return;
  }

  const hoja = window.XLSX.utils.json_to_sheet(filasExport());
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, 'Resumen por empleado');

  if (validacionActual) {
    const v = validacionActual;
    const recibidos = v.validas + v.descartesTotal;
    const pct = recibidos > 0 ? Math.round((v.validas / recibidos) * 100) : null;
    const resumenValidacion = [
      { Métrica: 'Paquetes válidos', Valor: v.validas },
      { Métrica: 'Descartados por validación', Valor: v.descartesTotal },
      { Métrica: 'Tasa de aceptación (%)', Valor: pct === null ? '--' : pct },
      ...Object.entries(v.descartesPorMotivo || {})
        .sort((a, b) => b[1] - a[1])
        .map(([codigo, total]) => ({
          Métrica: `  ${MOTIVOS_VALIDACION[codigo] || codigo}`,
          Valor: total,
        })),
      { Métrica: 'Errores de almacenamiento', Valor: v.erroresAlmacenamiento },
      { Métrica: 'Duplicados deduplicados (no son rechazo)', Valor: v.duplicados || 0 },
    ];
    const hojaValidacion = window.XLSX.utils.json_to_sheet(resumenValidacion);
    window.XLSX.utils.book_append_sheet(libro, hojaValidacion, 'Validación');
  }

  window.XLSX.writeFile(libro, `resumen-mediciones-${formatearNombreArchivo()}.xlsx`);
}

btnPDF.addEventListener('click', exportarPDF);
btnExcel.addEventListener('click', exportarExcel);
filterEmpleado.addEventListener('change', () => {
  if (!filterDesde.value || !filterHasta.value) {
    renderEstadoInicial(obtenerMensajeSinFechas());
    return;
  }
  cargarResumen().catch((error) => {
    console.error(error);
    medCount.textContent = error.message;
  });
});
filterDesde.addEventListener('change', programarRecarga);
filterHasta.addEventListener('change', programarRecarga);

// Por defecto el período es el día de hoy (Desde = Hasta = hoy) y se carga el
// resumen automáticamente, en vez de arrancar con la tabla vacía.
if (!filterDesde.value) filterDesde.value = hoyISO();
if (!filterHasta.value) filterHasta.value = hoyISO();
cargarResumen().catch((error) => {
  console.error(error);
  medCount.textContent = error.message;
});
