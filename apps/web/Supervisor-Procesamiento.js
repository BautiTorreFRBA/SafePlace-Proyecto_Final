const API_BASE_URL = 'http://localhost:8000/api/v1';
const tableBody = document.getElementById('procTableBody');
const kpiTotal = document.getElementById('kpiTotal');
const kpiValidados = document.getElementById('kpiValidados');
const kpiRechazados = document.getElementById('kpiRechazados');
const kpiTasa = document.getElementById('kpiTasa');
const chartPercent = document.getElementById('chartPercent');

let registros = [];

async function cargarRegistros() {
  const res = await fetch(`${API_BASE_URL}/dashboard/measurements?limit=50`);
  const json = await res.json();
  registros = (json.data || []).map((m) => ({
    hora: new Date(m.fecha_hora).toLocaleTimeString('es-AR'),
    origen: `BLE-SP-${String(m.id_dispositivo).padStart(3, '0')}`,
    tipo: 'Frec. Cardíaca',
    valor: String(m.frecuencia_cardiaca),
    estado: m.estado === 'rejected' ? 'rechazado' : m.estado === 'marked' ? 'marcado' : 'validado',
    detalle: m.estado || 'Persistido en DB',
  }));
  actualizarKPIs();
  renderTabla();
  renderChart();
}

function actualizarKPIs() {
  const total = registros.length;
  const validados = registros.filter((r) => r.estado === 'validado').length;
  const rechazados = registros.filter((r) => r.estado === 'rechazado').length;
  const porcentajeSinRechazos = total > 0 ? ((validados / total) * 100).toFixed(1) : 0;
  kpiTotal.textContent = String(total);
  kpiValidados.textContent = String(validados);
  kpiRechazados.textContent = String(rechazados);
  kpiTasa.textContent = `${total > 0 ? ((rechazados / total) * 100).toFixed(1) : 0}%`;
  chartPercent.textContent = `${porcentajeSinRechazos}%`;
}

function renderTabla() {
  tableBody.innerHTML = registros.map((r) => `<tr><td class="proc-hora">${r.hora}</td><td class="proc-origen">${r.origen}</td><td class="proc-tipo">${r.tipo}</td><td class="proc-valor">${r.valor}</td><td><span class="proc-badge-${r.estado}">${r.estado}</span></td><td class="proc-detalle">${r.detalle}</td></tr>`).join('');
}

function renderChart() {
  const validados = registros.filter((r) => r.estado === 'validado').length;
  const rechazados = registros.filter((r) => r.estado === 'rechazado').length + registros.filter((r) => r.estado === 'marcado').length;
  const ctx = document.getElementById('chartDistribucion').getContext('2d');
  if (window.chartDistribucion) window.chartDistribucion.destroy();
  window.chartDistribucion = new Chart(ctx, { type: 'doughnut', data: { labels: ['Validados', 'Rechazados'], datasets: [{ data: [validados, rechazados], backgroundColor: ['#4ade80', '#f87171'], borderColor: ['#0a0a0a', '#0a0a0a'], borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } } });
}

cargarRegistros().catch(console.error);
