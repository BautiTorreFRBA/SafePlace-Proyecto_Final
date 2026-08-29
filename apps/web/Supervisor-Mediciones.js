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

function renderTabla() {
  actualizarContador(resumen.length);

  if (resumen.length === 0) {
    renderEstadoInicial('No hay empleados con datos ni wearable asignado en el período');
    return;
  }

  tableBody.innerHTML = resumen.map((f) => {
    const nombre = `${f.nombre || ''} ${f.apellido || ''}`.trim() || `ID ${f.idTrabajador}`;
    const wearable = f.dispositivo
      ? `${f.dispositivo.marca || ''} ${f.dispositivo.modelo || ''}`.trim() || `#${f.dispositivo.id}`
      : '<span style="color:var(--text-muted)">sin asignar</span>';
    const fc = f.lecturas > 0
      ? `<span class="med-fc-value">${f.fcPromedio ?? '--'}</span> <span style="color:var(--text-muted); font-size:0.82rem">/ ${f.fcMin ?? '--'} / ${f.fcMax ?? '--'}</span>`
      : '<span style="color:var(--text-muted)">--</span>';
    const lecturas = f.lecturas > 0
      ? `${f.lecturas} <span style="color:var(--text-muted); font-size:0.82rem">(${f.minutosMonitoreados} min)</span>`
      : '<span style="color:var(--text-muted)">0</span>';
    const est = estadoFrescura(f);

    return `
      <tr>
        <td>
          <div>${escapeHtml(nombre)}</div>
          <div style="color:var(--text-muted); font-size:0.78rem">${escapeHtml(f.legajo || '')}${f.area ? ` · ${escapeHtml(f.area)}` : ''}</div>
        </td>
        <td style="color:var(--text-secondary); font-size:0.85rem">${escapeHtml(wearable)}</td>
        <td>${fc}</td>
        <td style="color:var(--text-secondary)">${lecturas}</td>
        <td>${celdaCobertura(f.coberturaPct)}</td>
        <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(rangoMarcas(f.primera, f.ultima))}</td>
        <td>${celdaAlertas(f.alertasPorTipo)}</td>
        <td><span class="badge ${est.clase}">${escapeHtml(est.texto)}</span></td>
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

renderEstadoInicial(obtenerMensajeSinFechas());
