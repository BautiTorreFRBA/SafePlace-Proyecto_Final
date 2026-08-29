const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const tableBody = document.getElementById('medTableBody');
const medCount = document.getElementById('medCount');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterHasta = document.getElementById('filterHasta');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');
const medValidacion = document.getElementById('medValidacion');

let mediciones = [];
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

function formatearFechaHora(fechaHora = '') {
  const fecha = new Date(fechaHora);
  if (Number.isNaN(fecha.getTime())) {
    return { fecha: '--', hora: '--' };
  }

  return {
    fecha: fecha.toLocaleDateString('es-AR'),
    hora: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function obtenerFiltros() {
  return {
    desde: filterDesde.value || '',
    hasta: filterHasta.value || '',
    empleado: filterEmpleado.value || '',
  };
}

function actualizarContador(total) {
  medCount.textContent = `${total} ${total === 1 ? 'registro encontrado' : 'registros encontrados'}`;
}

function renderEstadoInicial(mensaje) {
  mediciones = [];
  validacionActual = null;
  renderValidacion(null);
  actualizarContador(0);
  tableBody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">
        ${escapeHtml(mensaje)}
      </td>
    </tr>
  `;
}

function renderTabla() {
  actualizarContador(mediciones.length);

  if (mediciones.length === 0) {
    renderEstadoInicial('No hay mediciones que coincidan con los filtros');
    return;
  }

  tableBody.innerHTML = mediciones.map((m) => `
    <tr>
      <td>${escapeHtml(m.empleado)}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(m.fecha)} ${escapeHtml(m.hora)}</td>
      <td><span class="med-fc-value">${escapeHtml(m.bpm)}</span></td>
      <td style="color:var(--text-secondary)">${escapeHtml(m.actividad)}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(m.temp)}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(m.spo2)}</td>
    </tr>
  `).join('');
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

function actualizarGraficas(datos) {
  destruirGraficas();

  const ctxFc = document.getElementById('chartFrecuencia').getContext('2d');
  chartFc = new Chart(ctxFc, {
    type: 'line',
    data: {
      labels: datos.map((_, i) => `${i + 1}`),
      datasets: [{
        label: 'BPM',
        data: datos.map((d) => d.bpm),
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45, 212, 191, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
        pointBackgroundColor: '#2dd4bf',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function renderEmpleadoOptions(datos) {
  const actual = filterEmpleado.value;
  const nombres = Array.from(new Set(datos.map((item) => item.empleado).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  filterEmpleado.innerHTML = '<option value="">Todos</option>' + nombres
    .map((nombre) => `<option value="${escapeHtml(nombre)}">${escapeHtml(nombre)}</option>`)
    .join('');

  if (actual && nombres.includes(actual)) {
    filterEmpleado.value = actual;
  }
}

function obtenerMensajeSinFechas() {
  return 'Selecciona las fechas Desde y Hasta para consultar el historial de mediciones.';
}

function formatearNombreArchivo(fecha = new Date()) {
  return fecha.toISOString().slice(0, 10);
}

async function cargarMediciones() {
  const { desde, hasta, empleado } = obtenerFiltros();

  if (!desde || !hasta) {
    renderEstadoInicial(obtenerMensajeSinFechas());
    destruirGraficas();
    return;
  }

  const params = new URLSearchParams();
  params.set('desde', desde);
  params.set('hasta', hasta);
  params.set('limit', '200');
  if (empleado) params.set('empleado', empleado);

  const res = await fetch(`${API_BASE_URL}/mediciones?${params.toString()}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('No autorizado. Volve a iniciar sesion para ver las mediciones.');
    }

    if (res.status === 403) {
      throw new Error('Tu usuario no tiene permiso para ver el historial de mediciones.');
    }

    throw new Error(`No se pudo cargar el historial (${res.status})`);
  }

  const json = await res.json();
  const rows = Array.isArray(json.data) ? json.data : [];
  const validacion = json.validacion || null;

  mediciones = rows.map((m) => {
    const fechaHora = formatearFechaHora(m.fecha_hora);
    return {
      empleado: `${m.operario_nombre || ''} ${m.operario_apellido || ''}`.trim() || `ID ${m.id_trabajador}`,
      fecha: fechaHora.fecha,
      hora: fechaHora.hora,
      bpm: m.frecuencia_cardiaca ?? '--',
      actividad: m.actividad || '--',
      temp: m.temperatura_corporal ?? '--',
      spo2: m.spo2 ?? '--',
    };
  });

  renderEmpleadoOptions(mediciones);
  renderTabla();
  actualizarGraficas(mediciones);

  // Después de renderTabla: si no hubo filas coincidentes llamó a
  // renderEstadoInicial y limpió el panel; lo repoblamos con el resumen real
  // del período (que no depende del filtro por empleado).
  validacionActual = validacion;
  renderValidacion(validacionActual);
}

function programarRecarga() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    cargarMediciones().catch((error) => {
      console.error(error);
      medCount.textContent = error.message;
    });
  }, 250);
}

function exportarPDF() {
  if (mediciones.length === 0) {
    alert('No hay mediciones para exportar.');
    return;
  }

  if (!window.jspdf?.jsPDF) {
    alert('No se pudo cargar la libreria PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  doc.setFontSize(16);
  doc.text('Historial de Mediciones', 14, 15);
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

  doc.autoTable({
    startY: tablaInicio,
    head: [['Empleado', 'Fecha', 'Hora', 'BPM', 'Actividad', 'Temp.', 'SpO2']],
    body: mediciones.map((m) => [m.empleado, m.fecha, m.hora, m.bpm, m.actividad, m.temp, m.spo2]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });

  doc.save(`historial-mediciones-${formatearNombreArchivo()}.pdf`);
}

function exportarExcel() {
  if (mediciones.length === 0) {
    alert('No hay mediciones para exportar.');
    return;
  }

  if (!window.XLSX) {
    alert('No se pudo cargar la libreria Excel.');
    return;
  }

  const filas = mediciones.map((m) => ({
    Empleado: m.empleado,
    Fecha: m.fecha,
    Hora: m.hora,
    BPM: m.bpm,
    Actividad: m.actividad,
    Temperatura: m.temp,
    SpO2: m.spo2,
  }));

  const hoja = window.XLSX.utils.json_to_sheet(filas);
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, 'Mediciones');

  if (validacionActual) {
    const v = validacionActual;
    const recibidos = v.validas + v.descartesTotal;
    const pct = recibidos > 0 ? Math.round((v.validas / recibidos) * 100) : null;
    const resumen = [
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
    const hojaValidacion = window.XLSX.utils.json_to_sheet(resumen);
    window.XLSX.utils.book_append_sheet(libro, hojaValidacion, 'Validación');
  }

  window.XLSX.writeFile(libro, `historial-mediciones-${formatearNombreArchivo()}.xlsx`);
}

btnPDF.addEventListener('click', exportarPDF);
btnExcel.addEventListener('click', exportarExcel);
filterEmpleado.addEventListener('change', () => {
  if (!filterDesde.value || !filterHasta.value) {
    renderEstadoInicial(obtenerMensajeSinFechas());
    return;
  }
  cargarMediciones().catch((error) => {
    console.error(error);
    medCount.textContent = error.message;
  });
});
filterDesde.addEventListener('change', programarRecarga);
filterHasta.addEventListener('change', programarRecarga);

renderEstadoInicial(obtenerMensajeSinFechas());
