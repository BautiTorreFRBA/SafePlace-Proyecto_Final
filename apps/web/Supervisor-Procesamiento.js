/* ============================================================
   SAFEPLACE – PROCESAMIENTO.JS
   Historial de procesamiento de datos, validaciones y rechazos
   ============================================================ */

/* ────────────────────────────────────────────────────────────
   BASE DE DATOS DE EMPLEADOS
   ──────────────────────────────────────────────────────────── */
const empleados = [
  { id: 'JP', nombre: 'Juan Pérez',       depto: 'Producción',    rol: 'Trabajador' },
  { id: 'AM', nombre: 'Ana Martínez',     depto: 'Logística',     rol: 'Trabajador' },
  { id: 'PL', nombre: 'Pedro López',      depto: 'Mantenimiento', rol: 'Trabajador' },
  { id: 'LR', nombre: 'Laura Rodríguez',  depto: 'Producción',    rol: 'Trabajador' },
  { id: 'SH', nombre: 'Sofía Herrera',    depto: 'Producción',    rol: 'Trabajador' },
  { id: 'MT', nombre: 'Miguel Torres',    depto: 'Logística',     rol: 'Trabajador' },
  { id: 'VD', nombre: 'Valentina Díaz',   depto: 'Mantenimiento', rol: 'Trabajador' },
];

/* ────────────────────────────────────────────────────────────
   REGISTRO DE PROCESAMIENTO
   Historial de mediciones procesadas con validación
   ──────────────────────────────────────────────────────────── */
const registros = [
  { hora: '14:32:30', origen: 'BLE-SP-001', tipo: 'Frec. Cardíaca', valor: '78', estado: 'validado', detalle: 'Dentro de parámetros normales' },
  { hora: '14:32:28', origen: 'BLE-SP-003', tipo: 'Frec. Cardíaca', valor: '72', estado: 'validado', detalle: 'Dentro de parámetros normales' },
  { hora: '14:32:25', origen: 'BLE-SP-004', tipo: 'Frec. Cardíaca', valor: '135', estado: 'marcado', detalle: 'Valor por encima del umbral (120 BPM)' },
  { hora: '14:32:28', origen: 'BLE-SP-002', tipo: 'Actividad', valor: 'high', estado: 'validado', detalle: 'Actividad registrada correctamente' },
  { hora: '14:32:15', origen: 'BLE-SP-006', tipo: 'Frec. Cardíaca', valor: '-5', estado: 'rechazado', detalle: 'Valor negativo inválido' },
  { hora: '14:32:10', origen: 'BLE-SP-005', tipo: 'Temperatura', valor: '36.6', estado: 'validado', detalle: 'Temperatura corporal normal' },
  { hora: '14:32:05', origen: 'BLE-SP-007', tipo: 'Frec. Cardíaca', valor: '92', estado: 'validado', detalle: 'Dentro de parámetros normales' },
  { hora: '14:31:00', origen: 'BLE-SP-001', tipo: 'SpO₂', valor: '98', estado: 'validado', detalle: 'Saturación de oxígeno normal' },
  { hora: '14:31:55', origen: 'BLE-SP-004', tipo: 'Temperatura', valor: '42.5', estado: 'rechazado', detalle: 'Temperatura fuera de rango fisiológico' },
  { hora: '14:31:58', origen: 'BLE-SP-003', tipo: 'Actividad', valor: 'low', estado: 'validado', detalle: 'Actividad registrada correctamente' },
];

/* ────────────────────────────────────────────────────────────
   REFERENCIAS AL DOM
   ──────────────────────────────────────────────────────────── */
const tableBody     = document.getElementById('procTableBody');
const kpiTotal      = document.getElementById('kpiTotal');
const kpiValidados  = document.getElementById('kpiValidados');
const kpiRechazados = document.getElementById('kpiRechazados');
const kpiTasa       = document.getElementById('kpiTasa');
const chartPercent  = document.getElementById('chartPercent');

/* ────────────────────────────────────────────────────────────
   CALCULAR KPIs
   ──────────────────────────────────────────────────────────── */
function actualizarKPIs() {
  const total = registros.length;
  const validados = registros.filter(r => r.estado === 'validado').length;
  const rechazados = registros.filter(r => r.estado === 'rechazado').length;
  const tasa = total > 0 ? ((rechazados / total) * 100).toFixed(1) : 0;
  const porcentajeSinRechazos = total > 0 ? ((validados / total) * 100).toFixed(1) : 0;

  // Nota: el KPI total para la demo es 1847 (incluye histórico)
  // registros.length es solo la muestra visible en tabla
  kpiTotal.textContent = '1847';
  kpiValidados.textContent = '1756';
  kpiRechazados.textContent = '91';
  kpiTasa.textContent = '4.9%';
  chartPercent.textContent = `${porcentajeSinRechazos}%`;
}

/* ────────────────────────────────────────────────────────────
   RENDERIZAR TABLA
   ──────────────────────────────────────────────────────────── */
function renderTabla() {
  tableBody.innerHTML = registros.map(r => {
    const estadoClass = `proc-badge-${r.estado}`;

    return `
      <tr>
        <td class="proc-hora">${r.hora}</td>
        <td class="proc-origen">${r.origen}</td>
        <td class="proc-tipo">${r.tipo}</td>
        <td class="proc-valor">${r.valor}</td>
        <td><span class="${estadoClass}">${r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}</span></td>
        <td class="proc-detalle">${r.detalle}</td>
      </tr>
    `;
  }).join('');
}

/* ────────────────────────────────────────────────────────────
   GRÁFICO DONUT CON CHART.JS
   ──────────────────────────────────────────────────────────── */
function renderChart() {
  const validados = registros.filter(r => r.estado === 'validado').length;
  const rechazados = registros.filter(r => r.estado === 'rechazado').length;
  const marcados = registros.filter(r => r.estado === 'marcado').length;

  // Para la demo, mostramos validados vs rechazados (incluyendo marcados como rechazados)
  const totalRechazos = rechazados + marcados;

  const ctx = document.getElementById('chartDistribucion').getContext('2d');

  if (window.chartDistribucion) window.chartDistribucion.destroy();

  window.chartDistribucion = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Validados', 'Rechazados'],
      datasets: [{
        data: [validados, totalRechazos],
        backgroundColor: ['#4ade80', '#f87171'],
        borderColor: ['#0a0a0a', '#0a0a0a'],
        borderWidth: 3,
        circumference: 360,
        rotation: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed}`,
          },
        },
      },
    },
  });
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
actualizarKPIs();
renderTabla();
renderChart();