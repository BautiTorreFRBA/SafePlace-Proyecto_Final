const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const tableBody = document.getElementById('procTableBody');
const kpiTotal = document.getElementById('kpiTotal');
const kpiValidados = document.getElementById('kpiValidados');
const kpiRechazados = document.getElementById('kpiRechazados');
const kpiTasa = document.getElementById('kpiTasa');
const chartPercent = document.getElementById('chartPercent');

let registros = [];
let resumenHoy = { validados: 0, rechazados: 0 };

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'InicioSesion.html';
    return null;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'No se pudo completar la operación.');
  }

  return payload;
}

async function cargarRegistros() {
  const hoy = hoyISO();
  const [feed, resumen] = await Promise.all([
    apiFetch('/dashboard/measurements?limit=50'),
    apiFetch(`/mediciones/resumen?desde=${hoy}&hasta=${hoy}`),
  ]);

  registros = ((feed && feed.data) || []).map((m) => ({
    hora: new Date(m.fecha_hora).toLocaleTimeString('es-AR'),
    origen: `BLE-SP-${String(m.id_dispositivo).padStart(3, '0')}`,
    tipo: 'Frec. Cardíaca',
    valor: String(m.frecuencia_cardiaca),
    estado: m.estado === 'rejected' ? 'rechazado' : m.estado === 'marked' ? 'marcado' : 'validado',
    detalle: m.estado || 'Persistido en DB',
  }));

  actualizarKPIs((resumen && resumen.validacion) || {});
  renderTabla();
  renderChart();
}

// Las cards muestran el resultado REAL del Servicio de Validación de Datos para
// el día de hoy (mismo origen que "Validación de ingesta" en Mediciones:
// log_auditoria / DESCARTE_VALIDACION). No se derivan de la tabla de abajo, que
// es sólo un feed en vivo de las últimas 50 mediciones persistidas.
function actualizarKPIs(validacion) {
  const validados = Number(validacion.validas || 0);
  const rechazados = Number(validacion.descartesTotal || 0) + Number(validacion.erroresAlmacenamiento || 0);
  const total = validados + rechazados;
  const tasaValidacion = total > 0 ? ((validados / total) * 100).toFixed(1) : '0.0';
  const tasaRechazo = total > 0 ? ((rechazados / total) * 100).toFixed(1) : '0.0';
  kpiTotal.textContent = String(total);
  kpiValidados.textContent = String(validados);
  kpiRechazados.textContent = String(rechazados);
  kpiTasa.textContent = `${tasaRechazo}%`;
  chartPercent.textContent = `${tasaValidacion}%`;
  resumenHoy = { validados, rechazados };
}

function renderTabla() {
  tableBody.innerHTML = registros.map((r) => `<tr><td class="proc-hora">${r.hora}</td><td class="proc-origen">${r.origen}</td><td class="proc-tipo">${r.tipo}</td><td class="proc-valor">${r.valor}</td><td><span class="proc-badge-${r.estado}">${r.estado}</span></td><td class="proc-detalle">${r.detalle}</td></tr>`).join('');
}

function renderChart() {
  const { validados, rechazados } = resumenHoy;
  const ctx = document.getElementById('chartDistribucion').getContext('2d');
  if (window.chartDistribucion) window.chartDistribucion.destroy();
  window.chartDistribucion = new Chart(ctx, { type: 'doughnut', data: { labels: ['Validados', 'Rechazados'], datasets: [{ data: [validados, rechazados], backgroundColor: ['#4ade80', '#f87171'], borderColor: ['#0a0a0a', '#0a0a0a'], borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } } });
}

cargarRegistros().catch(console.error);
