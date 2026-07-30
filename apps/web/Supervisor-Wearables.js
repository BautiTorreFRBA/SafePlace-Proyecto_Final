const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const simGrid = document.getElementById('simGrid');
const tableBody = document.getElementById('wearTableBody');
const kpiConectados = document.getElementById('kpiConectados');
const kpiDesconectados = document.getElementById('kpiDesconectados');
const kpiBateria = document.getElementById('kpiBateria');

let dispositivos = [];

async function cargarDispositivos() {
  const res = await fetch(`${API_BASE_URL}/dashboard/devices`);
  const json = await res.json();
  dispositivos = (json.data || []).map((d) => ({
    id: `BLE-SP-${String(d.id).padStart(3, '0')}`,
    empleado: `${d.operario_nombre || ''} ${d.operario_apellido || ''}`.trim() || '--',
    estado: d.estado ? 'conectado' : 'desconectado',
    ble: d.operario_id ? 'vinculado' : 'buscando',
    signal: null,
    signalQuality: 'Sin dato',
    bateria: null,
    ultimaSinc: d.ultima_sinc ? new Date(d.ultima_sinc).toLocaleString('es-AR') : '--',
    paquetes: null,
  }));
}

function actualizarKPIs() {
  const conectados = dispositivos.filter((d) => d.estado === 'conectado').length;
  const total = dispositivos.length;
  const desconectados = dispositivos.filter((d) => d.estado === 'desconectado').length;
  const bateriaBaja = dispositivos.filter((d) => d.bateria !== null && d.bateria < 20).length;
  kpiConectados.textContent = `${conectados}/${total}`;
  kpiDesconectados.textContent = desconectados;
  kpiBateria.textContent = bateriaBaja;
}

function renderSimulacion() {
  simGrid.innerHTML = dispositivos.filter((d) => d.estado !== 'desconectado').slice(0, 5).map((d) => `
    <div class="wear-sim-card"><div class="wear-sim-card__id">${d.id}</div><div class="wear-sim-card__name">${d.empleado}</div><div class="wear-sim-card__status">Transmitiendo...</div><div class="wear-sim-card__packets">Paquetes: ${d.paquetes || '--'}</div></div>
  `).join('');
}

function renderTabla() {
  tableBody.innerHTML = dispositivos.map((d) => `
    <tr>
      <td style="color:var(--text-secondary); font-weight:500">${d.id}</td>
      <td>${d.empleado}</td>
      <td><span class="wear-badge-${d.estado}">${d.estado === 'conectado' ? 'Conectado' : 'Desconectado'}</span></td>
      <td><span class="wear-ble-${d.ble}">${d.ble === 'vinculado' ? 'Vinculado' : 'Buscando'}</span></td>
      <td><div class="wear-signal"><span style="color:var(--text-muted)">--- (Sin dato)</span></div></td>
      <td><div class="wear-battery"><span style="color:var(--text-muted)">--</span></div></td>
      <td style="color:var(--text-muted); font-size:0.82rem">${d.ultimaSinc}</td>
    </tr>
  `).join('');
}

async function init() {
  await cargarDispositivos();
  actualizarKPIs();
  renderSimulacion();
  renderTabla();
  setInterval(() => { renderSimulacion(); }, 5000);
}

document.getElementById('btnActualizar').addEventListener('click', init);
init().catch(console.error);
