/* FECHA Y HORA EN TIEMPO REAL */

function updateDateTime() {
  const el = document.getElementById('currentDate');
  if (!el) return;

  const now = new Date();

  // Formateamos la fecha con ceros a la izquierda (ej: 06/12/2026 21:05)
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
  const yyyy = now.getFullYear();
  const hh   = String(now.getHours()).padStart(2, '0');
  const min  = String(now.getMinutes()).padStart(2, '0');

  el.textContent = `Estado del sistema al ${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// Ejecutamos inmediatamente y repetimos cada minuto
updateDateTime();
setInterval(updateDateTime, 60_000);


/*  CONFIGURACIÓN GLOBAL DE GRAFICOS */

// Colores extraídos de las CSS variables (los replicamos en JS
// porque Chart.js no lee variables CSS directamente)
const COLORS = {
  teal:       '#2dd4bf',
  tealFill:   'rgba(45, 212, 191, 0.10)',
  red:        '#f87171',
  redLine:    'rgba(248, 113, 113, 0.6)',
  orange:     '#fb923c',
  yellow:     '#fbbf24',
  blue:       '#60a5fa',
  grid:       'rgba(255,255,255,0.04)',
  tickColor:  '#6b7280',
  tooltip:    '#413a3a',
};

// Tipografía base para todos los labels de Chart.js
Chart.defaults.color = COLORS.tickColor;
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size   = 11;

/* GRÁFICA DE BARRAS – Alertas por día (última semana) */

const alertsCtx = document.getElementById('alertsChart').getContext('2d');

new Chart(alertsCtx, {
  type: 'bar',

  data: {
    // Días de la semana abreviados (eje X)
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],

    datasets: [
      {
        label: 'Fatiga',
        // Cantidad de alertas de fatiga por día
        data: [0, 1, 0, 1, 1, 0, 1],
        backgroundColor: COLORS.yellow,
        borderRadius: 4,
        borderSkipped: false, // Redondea los 4 vértices
      },
      {
        label: 'Sobreesfuerzo',
        // Alertas de sobreesfuerzo por día
        data: [0, 0, 1, 1, 0, 1, 0],
        backgroundColor: COLORS.red,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Inactividad',
        // Alertas de inactividad prolongada por día
        data: [1, 2, 2, 4, 3, 3, 2],
        backgroundColor: COLORS.blue,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  },

  options: {
    responsive: true,
    maintainAspectRatio: false, // Permite que el canvas ocupe el alto del contenedor

    // Agrupación de barras
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true, // Usa círculos en lugar de rectángulos en la leyenda
          pointStyle: 'circle',
          padding: 16,
          color: COLORS.tickColor,
        },
      },
      tooltip: {
        backgroundColor: COLORS.tooltip,
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },

    scales: {
      x: {
        // Modo 'grouped' coloca las barras de cada dataset lado a lado
        stacked: false,
        grid: {
          color: COLORS.grid, // Líneas de cuadrícula muy sutiles
          drawBorder: false,
        },
        border: { display: false },
        ticks: { color: COLORS.tickColor },
      },
      y: {
        beginAtZero: true,
        max: 5, // Techo visual del eje Y
        ticks: {
          stepSize: 1, // Solo valores enteros (0, 1, 2…)
          color: COLORS.tickColor,
        },
        grid: {
          color: COLORS.grid,
          drawBorder: false,
        },
        border: { display: false },
      },
    },
  },
});


/* ------------------------------------------------------------
   4. GRÁFICA DE LÍNEA – Frecuencia Cardíaca Promedio (hoy)
   ------------------------------------------------------------
   Muestra la evolución del BPM promedio del equipo a lo largo
   del día (de 00:00 a 20:00, cada 4 horas).

   Incluye una línea de referencia de umbral crítico (130 BPM)
   implementada como un dataset separado con estilo punteado.
   ------------------------------------------------------------ */

const heartCtx = document.getElementById('heartChart').getContext('2d');

// Generamos un gradiente de relleno debajo de la curva para dar
// profundidad visual sin distraer del dato principal
const gradient = heartCtx.createLinearGradient(0, 0, 0, 200);
gradient.addColorStop(0,   'rgba(45, 212, 191, 0.20)');
gradient.addColorStop(1,   'rgba(45, 212, 191, 0.00)');

new Chart(heartCtx, {
  type: 'line',

  data: {
    // Horas del día en el eje X
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],

    datasets: [
      {
        label: 'BPM promedio',
        // Valores de frecuencia cardíaca promedio del equipo por hora
        data: [78, 80, 95, 105, 98, 90],
        borderColor:     COLORS.teal,
        backgroundColor: gradient,  // Área de relleno con degradado
        borderWidth:     2,
        pointRadius:     3,
        pointBackgroundColor: COLORS.teal,
        tension: 0.4,   // Suavizado de la curva (0 = recto, 1 = muy curvo)
        fill: true,     // Activa el área de relleno
      },
      {
        // Línea de umbral crítico: si el BPM supera este valor,
        // se genera una alerta automática en el sistema
        label: 'Umbral crítico (130 BPM)',
        data: [130, 130, 130, 130, 130, 130], // Línea horizontal constante
        borderColor:   COLORS.redLine,
        borderWidth:   1.5,
        borderDash:    [6, 4],  // Estilo punteado: 6px línea, 4px espacio
        pointRadius:   0,       // Sin puntos en esta línea de referencia
        fill:          false,
        tension:       0,
      },
    ],
  },

  options: {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        // Ocultamos la leyenda del umbral para no recargar la UI;
        // el rojo punteado es suficientemente claro visualmente
        display: false,
      },
      tooltip: {
        backgroundColor: COLORS.tooltip,
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        // Filtramos el dataset del umbral del tooltip para no confundir
        filter: (item) => item.datasetIndex === 0,
        callbacks: {
          // Agregamos la unidad al valor mostrado en el tooltip
          label: (ctx) => ` ${ctx.parsed.y} BPM`,
        },
      },
    },

    scales: {
      x: {
        grid: {
          color: COLORS.grid,
          drawBorder: false,
        },
        border: { display: false },
        ticks: { color: COLORS.tickColor },
      },
      y: {
        min: 50,  // Mínimo del eje: empieza en 50 BPM para mejor lectura
        max: 150, // Máximo del eje: deja espacio sobre el umbral de 130
        ticks: {
          stepSize: 25,
          color: COLORS.tickColor,
        },
        grid: {
          color: COLORS.grid,
          drawBorder: false,
        },
        border: { display: false },
      },
    },
  },
});
