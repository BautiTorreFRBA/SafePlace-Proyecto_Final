const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const tableBody = document.getElementById('medTableBody');
const medCount = document.getElementById('medCount');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterHasta = document.getElementById('filterHasta');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');

let mediciones = [];
let debounceTimer = null;
let chartFc = null;
let chartVolumen = null;

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

function normalizarTexto(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

function formatearEstado(estado) {
  if (typeof estado === 'boolean') {
    return estado ? 'Si' : 'No';
  }

  const normalizado = normalizarTexto(estado);
  if (['1', 'true', 'si', 's', 'valido', 'validado'].includes(normalizado)) {
    return 'Si';
  }

  return 'No';
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
  actualizarContador(0);
  tableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">
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
      <td><span class="${m.valido === 'Si' ? 'med-valid-si' : 'med-valid-no'}">${m.valido}</span></td>
    </tr>
  `).join('');
}

function destruirGraficas() {
  if (chartFc && typeof chartFc.destroy === 'function') {
    chartFc.destroy();
  }
  chartFc = null;

  if (chartVolumen && typeof chartVolumen.destroy === 'function') {
    chartVolumen.destroy();
  }
  chartVolumen = null;
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

  const ctxVolumen = document.getElementById('chartVolumen').getContext('2d');
  chartVolumen = new Chart(ctxVolumen, {
    type: 'line',
    data: {
      labels: datos.map((_, i) => `${i + 1}`),
      datasets: [{
        label: 'Lecturas',
        data: datos.map(() => 6),
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45, 212, 191, 0.2)',
        fill: true,
        pointRadius: 0,
        tension: 0.1,
        borderWidth: 2,
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
      valido: formatearEstado(m.estado),
    };
  });

  renderEmpleadoOptions(mediciones);
  renderTabla();
  actualizarGraficas(mediciones);
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

  doc.autoTable({
    startY: 28,
    head: [['Empleado', 'Fecha', 'Hora', 'BPM', 'Actividad', 'Temp.', 'SpO2', 'Válido']],
    body: mediciones.map((m) => [m.empleado, m.fecha, m.hora, m.bpm, m.actividad, m.temp, m.spo2, m.valido]),
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
    Válido: m.valido,
  }));

  const hoja = window.XLSX.utils.json_to_sheet(filas);
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, 'Mediciones');
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
