/* ACTUALIZAR HORA DEL SISTEMA */
function actualizarHora() {
  const now = new Date();
  const opciones = { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  };
  const fechaFormato = now.toLocaleDateString('es-ES', opciones).replace(/\//g, '/');
  document.getElementById('systemTime').textContent = fechaFormato;
}

// Actualizar hora al cargar y cada minuto
actualizarHora();
setInterval(actualizarHora, 60000);

/* GRÁFICA 1: ALERTAS POR DÍA (ÚLTIMA SEMANA) */
function renderChartAlertas() {
  const ctx = document.getElementById('chartAlertas').getContext('2d');

  const datos = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    fatiga: [1.2, 0.8, 1.5, 0.6, 1.3, 2.5, 1.8],
    sobresesfuerzo: [0.9, 1.2, 1.1, 1.4, 0.8, 1.6, 1.2],
    inactividad: [0.6, 0.9, 0.8, 0.7, 1.2, 0.9, 1.1],
  };

  window.chartAlertas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: datos.labels,
      datasets: [
        {
          label: 'Fatiga',
          data: datos.fatiga,
          backgroundColor: '#fb923c',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Sobresesfuerzo',
          data: datos.sobresesfuerzo,
          backgroundColor: '#f87171',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Inactividad',
          data: datos.inactividad,
          backgroundColor: '#60a5fa',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: undefined,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9ca3af',
            font: { size: 12 },
            padding: 16,
            usePointStyle: true,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 3,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b7280', font: { size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#6b7280', font: { size: 11 } },
        },
      },
    },
  });
}

/* GRÁFICA 2: FRECUENCIA CARDÍACA PROMEDIO (HOY) */
function renderChartFC() {
  const ctx = document.getElementById('chartFC').getContext('2d');

  const horas = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
  const datos = [75, 82, 88, 95, 92, 80];

  window.chartFC = new Chart(ctx, {
    type: 'line',
    data: {
      labels: horas,
      datasets: [{
        label: 'FC Promedio (BPM)',
        data: datos,
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45, 212, 191, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#2dd4bf',
        pointBorderColor: '#0a0a0a',
        pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 50,
          max: 150,
          ticks: {
            stepSize: 25,
            color: '#6b7280',
            font: { size: 11 },
          },
          grid: {
            color: 'rgba(255,255,255,0.04)',
            drawBorder: false,
          },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#6b7280', font: { size: 11 } },
        },
      },
    },
  });
}

/*  INIT */
renderChartAlertas();
renderChartFC();