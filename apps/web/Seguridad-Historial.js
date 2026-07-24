/* ============================================================
   SAFEPLACE – HISTORIALALERTAS.JS
   Historial de alertas con gráficas y filtros
   ============================================================ */

/* ────────────────────────────────────────────────────────────
   BASE DE DATOS DE HISTORIAL DE ALERTAS
   ──────────────────────────────────────────────────────────── */
const historicoAlertas = [
  { severidad: 'critico', tipo: 'Sobresesfuerzo', empleado: 'Laura Rodríguez', fecha: '15/12/2024 14:28', estado: 'activo' },
  { severidad: 'advertencia', tipo: 'Fatiga', empleado: 'Ana Martínez', fecha: '15/12/2024 14:15', estado: 'activo' },
  { severidad: 'advertencia', tipo: 'Inactividad', empleado: 'Miguel Torres', fecha: '15/12/2024 13:45', estado: 'enrevision' },
  { severidad: 'advertencia', tipo: 'Fatiga', empleado: 'Juan Pérez', fecha: '14/12/2024 16:30', estado: 'cerrada' },
  { severidad: 'critico', tipo: 'Sobresesfuerzo', empleado: 'Pedro López', fecha: '13/12/2024 10:15', estado: 'cerrada' },
  { severidad: 'info', tipo: 'Inactividad', empleado: 'Sofía Herrera', fecha: '12/12/2024 12:00', estado: 'cerrada' },
  { severidad: 'advertencia', tipo: 'Fatiga', empleado: 'Valentina Díaz', fecha: '15/12/2024 14:00', estado: 'activo' },
  { severidad: 'critico', tipo: 'Sobresesfuerzo', empleado: 'Laura Rodríguez', fecha: '10/12/2024 09:45', estado: 'cerrada' },
];

/* ────────────────────────────────────────────────────────────
   REFERENCIAS AL DOM
   ──────────────────────────────────────────────────────────── */
const tableBody = document.getElementById('histTableBody');
const histCount = document.getElementById('histCount');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterTipo = document.getElementById('filterTipo');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');

/* ────────────────────────────────────────────────────────────
   ACTUALIZAR CONTADOR
   ──────────────────────────────────────────────────────────── */
function actualizarContador(cantidad) {
  histCount.textContent = `${cantidad} ${cantidad === 1 ? 'registro encontrado' : 'registros encontrados'}`;
}

/* ────────────────────────────────────────────────────────────
   RENDERIZAR TABLA CON FILTROS
   ──────────────────────────────────────────────────────────── */
function renderTabla() {
  const empleado = filterEmpleado.value.toLowerCase();
  const desde = filterDesde.value;
  const tipo = filterTipo.value;

  const filtrados = historicoAlertas.filter(a => {
    const matchEmpleado = !empleado || a.empleado.toLowerCase().includes(empleado);
    const matchTipo = !tipo || a.tipo === tipo;
    return matchEmpleado && matchTipo;
  });

  actualizarContador(filtrados.length);

  tableBody.innerHTML = filtrados.map(a => {
    const badgeSeveridad = `hist-badge-${a.severidad}`;
    const labelSeveridad = a.severidad === 'critico' ? 'Crítico' 
                         : a.severidad === 'advertencia' ? 'Advertencia' 
                         : 'Info';

    const badgeEstado = `hist-badge-${a.estado}`;
    const labelEstado = a.estado === 'activo' ? 'Activo' 
                      : a.estado === 'enrevision' ? 'En revisión' 
                      : 'Cerrada';

    return `
      <tr>
        <td><span class="hist-badge-severidad ${badgeSeveridad}">${labelSeveridad}</span></td>
        <td class="hist-td-tipo">${a.tipo}</td>
        <td class="hist-td-empleado">${a.empleado}</td>
        <td class="hist-td-fecha">${a.fecha}</td>
        <td><span class="hist-badge-estado ${badgeEstado}">${labelEstado}</span></td>
      </tr>
    `;
  }).join('');

  actualizarGraficas(filtrados);
}

/* ────────────────────────────────────────────────────────────
   ACTUALIZAR GRÁFICAS
   ──────────────────────────────────────────────────────────── */
function actualizarGraficas(datos) {
  /* Gráfica 1: Distribución por Tipo */
  const tiposCount = {};
  datos.forEach(d => {
    tiposCount[d.tipo] = (tiposCount[d.tipo] || 0) + 1;
  });

  const ctxTipo = document.getElementById('chartTipo').getContext('2d');
  if (window.chartTipo) window.chartTipo.destroy();

  window.chartTipo = new Chart(ctxTipo, {
    type: 'doughnut',
    data: {
      labels: Object.keys(tiposCount),
      datasets: [{
        data: Object.values(tiposCount),
        backgroundColor: ['#fb923c', '#f87171', '#60a5fa'],
        borderColor: '#0a0a0a',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'left',
          labels: {
            color: '#9ca3af',
            font: { size: 12 },
            padding: 16,
            usePointStyle: true,
          },
        },
      },
    },
  });

  /* Gráfica 2: Por Nivel de Severidad */
  const severidadCount = {
    critico: datos.filter(d => d.severidad === 'critico').length,
    advertencia: datos.filter(d => d.severidad === 'advertencia').length,
    info: datos.filter(d => d.severidad === 'info').length,
  };

  const ctxSeveridad = document.getElementById('chartSeveridad').getContext('2d');
  if (window.chartSeveridad) window.chartSeveridad.destroy();

  window.chartSeveridad = new Chart(ctxSeveridad, {
    type: 'bar',
    data: {
      labels: ['Crítico', 'Advertencia', 'Info'],
      datasets: [{
        label: 'Cantidad',
        data: [severidadCount.critico, severidadCount.advertencia, severidadCount.info],
        backgroundColor: '#2dd4bf',
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: undefined,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: '#6b7280',
            font: { size: 11 },
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#6b7280', font: { size: 11 } },
        },
      },
    },
  });
}

/* ────────────────────────────────────────────────────────────
   EVENTOS DE FILTROS
   ──────────────────────────────────────────────────────────── */
filterEmpleado.addEventListener('input', renderTabla);
filterTipo.addEventListener('change', renderTabla);

/* ────────────────────────────────────────────────────────────
   EVENTOS DE EXPORTACIÓN
   ──────────────────────────────────────────────────────────── */
btnPDF.addEventListener('click', () => {
  alert('Exportar a PDF - Función simulada');
});

btnExcel.addEventListener('click', () => {
  alert('Exportar a Excel - Función simulada');
});

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
renderTabla();