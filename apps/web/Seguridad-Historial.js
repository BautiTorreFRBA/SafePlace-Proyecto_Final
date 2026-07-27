const API_BASE_URL = 'http://localhost:8000/api/v1';
const tableBody = document.getElementById('histTableBody');
const histCount = document.getElementById('histCount');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterTipo = document.getElementById('filterTipo');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');
const chartTipoCanvas = document.getElementById('chartTipo');
const chartSeveridadCanvas = document.getElementById('chartSeveridad');

let historicoAlertas = [];
let chartTipo = null;
let chartSeveridad = null;

function normalizarTexto(texto = '') {
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapearSeveridad(tipoAlerta = '') {
  const tipo = normalizarTexto(tipoAlerta);
  if (tipo.includes('crit')) return 'critico';
  if (tipo.includes('info')) return 'info';
  return 'advertencia';
}

function mapearTipo(tipoAlerta = '') {
  const tipo = tipoAlerta.toString().trim();
  return tipo || 'Alerta';
}

function mapearEstado(estado = '') {
  const normalizado = normalizarTexto(estado);
  if (normalizado.includes('activo')) return 'activo';
  if (normalizado.includes('revision')) return 'enrevision';
  if (normalizado.includes('cerr')) return 'cerrada';
  return 'activo';
}

function obtenerFiltrados() {
  const empleado = normalizarTexto(filterEmpleado.value);
  const tipo = filterTipo.value;

  return historicoAlertas.filter((a) => {
    const coincideEmpleado = !empleado || normalizarTexto(a.empleado).includes(empleado);
    const coincideTipo = !tipo || a.tipo === tipo;
    return coincideEmpleado && coincideTipo;
  });
}

function actualizarContador(cantidad) {
  histCount.textContent = `${cantidad} ${cantidad === 1 ? 'registro encontrado' : 'registros encontrados'}`;
}

function renderTabla() {
  const filtrados = obtenerFiltrados();
  actualizarContador(filtrados.length);

  tableBody.innerHTML = filtrados
    .map(
      (a) => `
        <tr>
          <td><span class="hist-badge-severidad hist-badge-${a.severidad}">${a.severidad}</span></td>
          <td class="hist-td-tipo">${a.tipo}</td>
          <td class="hist-td-empleado">${a.empleado}</td>
          <td class="hist-td-fecha">${a.fecha}</td>
          <td><span class="hist-badge-estado hist-badge-${a.estado}">${a.estado}</span></td>
        </tr>`
    )
    .join('');
}

function destruirGraficas() {
  if (chartTipo) {
    chartTipo.destroy();
    chartTipo = null;
  }
  if (chartSeveridad) {
    chartSeveridad.destroy();
    chartSeveridad = null;
  }
}

function renderGraficas() {
  const filtrados = obtenerFiltrados();
  const conteoPorTipo = { Fatiga: 0, Sobreesfuerzo: 0, Inactividad: 0 };
  const conteoPorSeveridad = { Crítico: 0, Advertencia: 0, Info: 0 };

  filtrados.forEach((a) => {
    const tipo = a.tipo;
    if (Object.prototype.hasOwnProperty.call(conteoPorTipo, tipo)) {
      conteoPorTipo[tipo] += 1;
    } else {
      conteoPorTipo[tipo] = (conteoPorTipo[tipo] || 0) + 1;
    }

    if (a.severidad === 'critico') conteoPorSeveridad['Crítico'] += 1;
    else if (a.severidad === 'advertencia') conteoPorSeveridad['Advertencia'] += 1;
    else conteoPorSeveridad['Info'] += 1;
  });

  destruirGraficas();

  chartTipo = new Chart(chartTipoCanvas, {
    type: 'pie',
    data: {
      labels: Object.keys(conteoPorTipo),
      datasets: [{
        data: Object.values(conteoPorTipo),
        backgroundColor: ['#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'],
        borderColor: '#111827',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#cbd5e1', boxWidth: 14, boxHeight: 14 },
        },
      },
    },
  });

  chartSeveridad = new Chart(chartSeveridadCanvas, {
    type: 'bar',
    data: {
      labels: Object.keys(conteoPorSeveridad),
      datasets: [{
        data: Object.values(conteoPorSeveridad),
        backgroundColor: ['#2dd4bf', '#22c55e', '#60a5fa'],
        borderRadius: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
        y: { beginAtZero: true, ticks: { precision: 0, color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    },
  });
}

function exportarPDF() {
  if (!window.jspdf?.jsPDF) {
    alert('No se pudo cargar la librería PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  const filas = obtenerFiltrados();

  doc.setFontSize(16);
  doc.text('Historial de Alertas', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, 22);

  doc.autoTable({
    startY: 28,
    head: [['Severidad', 'Tipo', 'Empleado', 'Fecha', 'Estado']],
    body: filas.map((a) => [a.severidad, a.tipo, a.empleado, a.fecha, a.estado]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });

  doc.save('historial-alertas.pdf');
}

function exportarExcel() {
  if (!window.XLSX) {
    alert('No se pudo cargar la librería Excel.');
    return;
  }

  const filas = obtenerFiltrados().map((a) => ({
    Severidad: a.severidad,
    Tipo: a.tipo,
    Empleado: a.empleado,
    Fecha: a.fecha,
    Estado: a.estado,
  }));

  const hoja = window.XLSX.utils.json_to_sheet(filas);
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, 'Historial');
  window.XLSX.writeFile(libro, 'historial-alertas.xlsx');
}

async function cargarHistorial() {
  const params = new URLSearchParams();
  if (filterDesde.value) {
    params.set('desde', `${filterDesde.value}T00:00:00.000Z`);
  }

  const res = await fetch(`${API_BASE_URL}/dashboard/alerts?${params.toString()}`);
  const json = await res.json();
  historicoAlertas = (json.data || []).map((a) => ({
    severidad: mapearSeveridad(a.tipo_alerta || ''),
    tipo: mapearTipo(a.tipo_alerta || ''),
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    fecha: new Date(a.fecha_hora).toLocaleString('es-AR'),
    estado: mapearEstado(a.estado || ''),
  }));

  renderTabla();
  renderGraficas();
}

filterEmpleado.addEventListener('input', () => {
  renderTabla();
  renderGraficas();
});
filterTipo.addEventListener('change', () => {
  renderTabla();
  renderGraficas();
});
filterDesde.addEventListener('change', () => cargarHistorial().catch(console.error));
btnPDF.addEventListener('click', exportarPDF);
btnExcel.addEventListener('click', exportarExcel);

cargarHistorial().catch(console.error);
