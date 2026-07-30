const API_BASE_URL = 'https://safeplace-backend-9vhx.onrender.com/api/v1';
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
let debounceTimer = null;

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

function capitalizar(texto = '') {
  const limpio = String(texto).trim();
  if (!limpio) {
    return '';
  }
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

function formatearSeveridad(prioridad = '') {
  const normalizada = normalizarTexto(prioridad);

  if (!normalizada) {
    return { clase: 'info', texto: 'Sin dato' };
  }

  if (['critico', 'critica', 'alta', 'high', '1'].includes(normalizada)) {
    return { clase: 'critico', texto: capitalizar(prioridad) || 'Critico' };
  }

  if (['advertencia', 'warning', 'media', 'medio', 'medium', '2'].includes(normalizada)) {
    return { clase: 'advertencia', texto: capitalizar(prioridad) || 'Advertencia' };
  }

  if (['info', 'informativa', 'informacion', 'baja', 'low', '3'].includes(normalizada)) {
    return { clase: 'info', texto: capitalizar(prioridad) || 'Info' };
  }

  return {
    clase: 'info',
    texto: capitalizar(prioridad) || String(prioridad),
  };
}

function formatearEstado(estado = '') {
  const normalizado = normalizarTexto(estado);

  if (normalizado.includes('cerr')) {
    return { clase: 'cerrada', texto: capitalizar(estado) || 'Cerrada' };
  }

  if (normalizado.includes('rev')) {
    return { clase: 'enrevision', texto: capitalizar(estado) || 'En revision' };
  }

  if (normalizado.includes('act')) {
    return { clase: 'activo', texto: capitalizar(estado) || 'Activo' };
  }

  return {
    clase: 'activo',
    texto: capitalizar(estado) || 'Activo',
  };
}

function formatearFecha(fechaHora = '') {
  const fecha = new Date(fechaHora);
  if (Number.isNaN(fecha.getTime())) {
    return '--';
  }

  return fecha.toLocaleString('es-AR');
}

function obtenerFiltros() {
  return {
    desde: filterDesde.value || '',
    tipo: filterTipo.value.trim(),
    empleado: filterEmpleado.value.trim(),
  };
}

function actualizarContador(cantidad) {
  histCount.textContent = `${cantidad} ${cantidad === 1 ? 'registro encontrado' : 'registros encontrados'}`;
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

function renderEstadoInicial(mensaje) {
  historicoAlertas = [];
  actualizarContador(0);
  tableBody.innerHTML = `
    <tr>
      <td colspan="5" style="padding: 18px 20px; color: #9ca3af;">
        ${escapeHtml(mensaje)}
      </td>
    </tr>
  `;
  destruirGraficas();
}

function renderTabla() {
  actualizarContador(historicoAlertas.length);

  if (historicoAlertas.length === 0) {
    renderEstadoInicial('No se encontraron alertas para los filtros seleccionados.');
    return;
  }

  tableBody.innerHTML = historicoAlertas
    .map((a) => `
      <tr>
        <td>
          <span class="hist-badge-severidad hist-badge-${a.severidad.clase}">
            ${escapeHtml(a.severidad.texto)}
          </span>
        </td>
        <td class="hist-td-tipo">${escapeHtml(a.tipo)}</td>
        <td class="hist-td-empleado">${escapeHtml(a.empleado)}</td>
        <td class="hist-td-fecha">${escapeHtml(a.fecha)}</td>
        <td>
          <span class="hist-badge-estado hist-badge-${a.estado.clase}">
            ${escapeHtml(a.estado.texto)}
          </span>
        </td>
      </tr>`)
    .join('');
}

function renderGraficas() {
  const conteoPorTipo = {};
  const conteoPorSeveridad = {
    Critico: 0,
    Advertencia: 0,
    Info: 0,
  };

  historicoAlertas.forEach((a) => {
    conteoPorTipo[a.tipo] = (conteoPorTipo[a.tipo] || 0) + 1;

    if (a.severidad.clase === 'critico') {
      conteoPorSeveridad.Critico += 1;
    } else if (a.severidad.clase === 'advertencia') {
      conteoPorSeveridad.Advertencia += 1;
    } else {
      conteoPorSeveridad.Info += 1;
    }
  });

  destruirGraficas();

  chartTipo = new Chart(chartTipoCanvas, {
    type: 'pie',
    data: {
      labels: Object.keys(conteoPorTipo),
      datasets: [{
        data: Object.values(conteoPorTipo),
        backgroundColor: ['#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6'],
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
        backgroundColor: ['#ef4444', '#f59e0b', '#60a5fa'],
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
    alert('No se pudo cargar la libreria PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  doc.setFontSize(16);
  doc.text('Historial de Alertas', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, 22);

  doc.autoTable({
    startY: 28,
    head: [['Severidad', 'Tipo', 'Empleado', 'Fecha', 'Estado']],
    body: historicoAlertas.map((a) => [a.severidad.texto, a.tipo, a.empleado, a.fecha, a.estado.texto]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });

  doc.save('historial-alertas.pdf');
}

function exportarExcel() {
  if (!window.XLSX) {
    alert('No se pudo cargar la libreria Excel.');
    return;
  }

  const filas = historicoAlertas.map((a) => ({
    Severidad: a.severidad.texto,
    Tipo: a.tipo,
    Empleado: a.empleado,
    Fecha: a.fecha,
    Estado: a.estado.texto,
  }));

  const hoja = window.XLSX.utils.json_to_sheet(filas);
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, 'Historial');
  window.XLSX.writeFile(libro, 'historial-alertas.xlsx');
}

async function cargarHistorial() {
  const { desde, tipo, empleado } = obtenerFiltros();

  if (!desde) {
    renderEstadoInicial('Seleccion una fecha en el filtro Desde para consultar el historial.');
    return;
  }

  const params = new URLSearchParams();
  params.set('desde', desde);
  if (tipo) params.set('tipo', tipo);
  if (empleado) params.set('empleado', empleado);

  const url = `${API_BASE_URL}/alertas/historico?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('No autorizado. Volve a iniciar sesión para ver el historial.');
    }

    if (res.status === 403) {
      throw new Error('Tu usuario no tiene permiso para ver el historial de alertas.');
    }

    throw new Error(`No se pudo cargar el historial (${res.status})`);
  }

  const json = await res.json();
  historicoAlertas = (json.data || []).map((a) => {
    const severidad = formatearSeveridad(a.prioridad ?? a.prioridad_alerta ?? '');
    const estado = formatearEstado(a.estado || '');
    const nombreEmpleado = `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim();

    return {
      severidad,
      tipo: a.tipo_alerta || 'Alerta',
      empleado: nombreEmpleado || '--',
      fecha: formatearFecha(a.fecha_hora),
      estado,
    };
  });

  renderTabla();
  renderGraficas();
}

function programarRecarga() {
  if (!filterDesde.value) {
    renderEstadoInicial('Seleccion una fecha en el filtro Desde para consultar el historial.');
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    cargarHistorial().catch((error) => {
      console.error(error);
      histCount.textContent = error.message;
    });
  }, 250);
}

filterEmpleado.addEventListener('input', programarRecarga);
filterTipo.addEventListener('change', programarRecarga);
filterDesde.addEventListener('change', () => {
  if (!filterDesde.value) {
    renderEstadoInicial('Seleccion una fecha en el filtro Desde para consultar el historial.');
    return;
  }

  cargarHistorial().catch((error) => {
    console.error(error);
    histCount.textContent = error.message;
  });
});
btnPDF.addEventListener('click', exportarPDF);
btnExcel.addEventListener('click', exportarExcel);

renderEstadoInicial('Seleccion una fecha en el filtro Desde para consultar el historial.');
