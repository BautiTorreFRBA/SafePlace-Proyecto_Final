/* BASE DE DATOS DE EMPLEADOS */
const empleados = [
  { id: 'JP', nombre: 'Juan Pérez',       depto: 'Producción',    rol: 'Trabajador' },
  { id: 'AM', nombre: 'Ana Martínez',     depto: 'Logística',     rol: 'Trabajador' },
  { id: 'PL', nombre: 'Pedro López',      depto: 'Mantenimiento', rol: 'Trabajador' },
  { id: 'LR', nombre: 'Laura Rodríguez',  depto: 'Producción',    rol: 'Trabajador' },
  { id: 'SH', nombre: 'Sofía Herrera',    depto: 'Producción',    rol: 'Trabajador' },
  { id: 'MT', nombre: 'Miguel Torres',    depto: 'Logística',     rol: 'Trabajador' },
  { id: 'VD', nombre: 'Valentina Díaz',   depto: 'Mantenimiento', rol: 'Trabajador' },
];

/* DATOS DE MEDICIONES : Historial de mediciones biométricas de los empleados. */
const mediciones = [
  {
    empleado: 'Ana Martínez',
    fecha: '2026-06-16',
    hora: '16:46',
    bpm: 93,
    actividad: 'Baja',
    temp: '36.9°C',
    spo2: '97%',
    valido: 'Sí',
  },
  {
    empleado: 'Valentina Díaz',
    fecha: '2026-06-17',
    hora: '16:45',
    bpm: 77,
    actividad: 'Moderada',
    temp: '37.1°C',
    spo2: '95%',
    valido: 'Sí',
  },
  {
    empleado: 'Pedro López',
    fecha: '2026-06-19',
    hora: '16:37',
    bpm: 76,
    actividad: 'Baja',
    temp: '36.5°C',
    spo2: '100%',
    valido: 'No',
  },
  {
    empleado: 'Laura Rodríguez',
    fecha: '2026-06-20',
    hora: '16:32',
    bpm: 97,
    actividad: 'Moderada',
    temp: '37.2°C',
    spo2: '97%',
    valido: 'No',
  },
  {
    empleado: 'Sofía Herrera',
    fecha: '2026-06-21',
    hora: '16:18',
    bpm: 72,
    actividad: 'Moderada',
    temp: '36.3°C',
    spo2: '100%',
    valido: 'Sí',
  },
  {
    empleado: 'Juan Pérez',
    fecha: '2026-06-22',
    hora: '16:17',
    bpm: 82,
    actividad: 'Alta',
    temp: '36.9°C',
    spo2: '99%',
    valido: 'Sí',
  },
  {
    empleado: 'Ana Martínez',
    fecha: '2026-06-23',
    hora: '15:55',
    bpm: 79,
    actividad: 'Moderada',
    temp: '36.5°C',
    spo2: '97%',
    valido: 'Sí',
  },
  {
    empleado: 'Juan Pérez',
    fecha: '2026-06-24',
    hora: '15:49',
    bpm: 70,
    actividad: 'Moderada',
    temp: '36.3°C',
    spo2: '97%',
    valido: 'Sí',
  },
];

/* INICIALIZAR SELECT DE EMPLEADOS */
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('filterEmpleado');
  empleados.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.nombre;
    option.textContent = emp.nombre;
    select.appendChild(option);
  });
});

/* REFERENCIAS AL DOM */
const tableBody = document.getElementById('medTableBody');
const medCount = document.getElementById('medCount');
const filterEmpleado= document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterHasta = document.getElementById('filterHasta');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');

/* RENDER DE TABLA */
function renderTabla() {
  const empleado = filterEmpleado.value;
  const desde = filterDesde.value;
  const hasta = filterHasta.value;

  /* Aplicamos los filtros */
  const filtrados = mediciones.filter(m => {
    const matchEmpleado = !empleado || m.empleado === empleado;
    const matchFecha = m.fecha >= desde && m.fecha <= hasta;
    return matchEmpleado && matchFecha;
  });

  /* Actualizamos el contador */
  medCount.textContent = `${filtrados.length}/${mediciones.length} registros`;

  /* Si no hay resultados mostramos mensaje */
  if (filtrados.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">
          No hay mediciones que coincidan con los filtros
        </td>
      </tr>
    `;
    return;
  }

  /* Construimos las filas de la tabla */
  tableBody.innerHTML = filtrados.map(m => {
    const bpmClass = m.bpm > 100 ? 'med-fc-value--alto' : m.bpm > 120 ? 'med-fc-value--critico' : '';
    const validClass = m.valido === 'Sí' ? 'med-valid-si' : 'med-valid-no';

    return `
      <tr>
        <td>${m.empleado}</td>
        <td style="color:var(--text-muted); font-size:0.82rem">${m.fecha} ${m.hora}</td>
        <td><span class="med-fc-value ${bpmClass}">${m.bpm}</span></td>
        <td style="color:var(--text-secondary)">${m.actividad}</td>
        <td style="color:var(--text-secondary)">${m.temp}</td>
        <td style="color:var(--text-secondary)">${m.spo2}</td>
        <td><span class="${validClass}">${m.valido}</span></td>
      </tr>
    `;
  }).join('');

  /* Actualizamos las gráficas con los datos filtrados */
  actualizarGraficas(filtrados);
}

/* ACTUALIZAR GRÁFICAS */
function actualizarGraficas(datos) {
  /* GRÁFICA 1: Evolución de Frecuencia Cardíaca */
  const ctxFc = document.getElementById('chartFrecuencia').getContext('2d');

  if (window.chartFc) window.chartFc.destroy();

  window.chartFc = new Chart(ctxFc, {
    type: 'line',
    data: {
      labels: datos.map((_, i) => `${i + 1}`),
      datasets: [
        {
          label: 'BPM',
          data: datos.map(d => d.bpm),
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45, 212, 191, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointBackgroundColor: '#2dd4bf',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 50,
          max: 150,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b7280' },
        },
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b7280' },
        },
      },
    },
  });

  /* GRÁFICA 2: Volumen de Lecturas */
  const ctxVolumen = document.getElementById('chartVolumen').getContext('2d');

  if (window.chartVolumen) window.chartVolumen.destroy();

  window.chartVolumen = new Chart(ctxVolumen, {
    type: 'line',
    data: {
      labels: datos.map((_, i) => `${i + 1}`),
      datasets: [
        {
          label: 'Lecturas',
          data: datos.map(() => 6),
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45, 212, 191, 0.2)',
          fill: true,
          pointRadius: 0,
          tension: 0.1,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 0,
          max: 8,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b7280' },
        },
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b7280' },
        },
      },
    },
  });
}

/* EVENTOS DE EXPORTACIÓN */

btnPDF.addEventListener('click', () => {
  alert('Exportar a PDF - Función simulada. En producción usarías jsPDF o similar.');
});

btnExcel.addEventListener('click', () => {
  alert('Exportar a Excel - Función simulada. En producción usarías SheetJS o similar.');
});

/* EVENTOS DE FILTROS*/
[filterEmpleado, filterDesde, filterHasta].forEach(el => {
  el.addEventListener('change', renderTabla);
});

/* INIT */
renderTabla();