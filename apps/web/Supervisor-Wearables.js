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

/* BASE DE DATOS DE DISPOSITIVOS WEARABLE */
const dispositivos = [
  {
    id: 'BLE-SP-001',
    empleado: 'Juan Pérez',
    estado: 'conectado',        // 'conectado' | 'desconectado' | 'advertencia'
    ble: 'vinculado',           // 'vinculado' | 'buscando'
    signal: -42,                // dBm
    signalQuality: 'Excelente',
    bateria: 85,                // porcentaje
    ultimaSinc: '15/12 14:32:00',
    paquetes: 1212,
  },
  {
    id: 'BLE-SP-002',
    empleado: 'Ana Martínez',
    estado: 'conectado',
    ble: 'vinculado',
    signal: -55,
    signalQuality: 'Buena',
    bateria: 72,
    ultimaSinc: '15/12 14:31:00',
    paquetes: 1220,
  },
  {
    id: 'BLE-SP-003',
    empleado: 'Pedro López',
    estado: 'conectado',
    ble: 'vinculado',
    signal: -38,
    signalQuality: 'Excelente',
    bateria: 93,
    ultimaSinc: '15/12 14:32:30',
    paquetes: 1216,
  },
  {
    id: 'BLE-SP-004',
    empleado: 'Laura Rodríguez',
    estado: 'advertencia',
    ble: 'vinculado',
    signal: -68,
    signalQuality: 'Regular',
    bateria: 15,
    ultimaSinc: '15/12 14:28:00',
    paquetes: null,
  },
  {
    id: 'BLE-SP-005',
    empleado: 'Sofía Herrera',
    estado: 'conectado',
    ble: 'vinculado',
    signal: -45,
    signalQuality: 'Excelente',
    bateria: 67,
    ultimaSinc: '15/12 14:32:10',
    paquetes: 1220,
  },
  {
    id: 'BLE-SP-006',
    empleado: 'Miguel Torres',
    estado: 'desconectado',
    ble: 'buscando',
    signal: null,
    signalQuality: 'Sin señal',
    bateria: 45,
    ultimaSinc: '15/12 13:15:00',
    paquetes: null,
  },
  {
    id: 'BLE-SP-007',
    empleado: 'Valentina Díaz',
    estado: 'conectado',
    ble: 'vinculado',
    signal: -50,
    signalQuality: 'Buena',
    bateria: 58,
    ultimaSinc: '15/12 14:31:45',
    paquetes: 1208,
  },
];

/* REFERENCIAS AL DOM */
const simGrid       = document.getElementById('simGrid');
const tableBody     = document.getElementById('wearTableBody');
const kpiConectados = document.getElementById('kpiConectados');
const kpiDesconectados = document.getElementById('kpiDesconectados');
const kpiBateria    = document.getElementById('kpiBateria');

/* CALCULAR Y MOSTRAR KPIs*/
function actualizarKPIs() {
  const conectados = dispositivos.filter(d => d.estado === 'conectado').length;
  const total = dispositivos.length;
  const desconectados = dispositivos.filter(d => d.estado === 'desconectado').length;
  const bateriaBaja = dispositivos.filter(d => d.bateria !== null && d.bateria < 20).length;

  kpiConectados.textContent = `${conectados}/${total}`;
  kpiDesconectados.textContent = desconectados;
  kpiBateria.textContent = bateriaBaja;
}

/* RENDERIZAR SIMULACIÓN DE TRANSMISIÓN*/
function renderSimulacion() {
  // Solo mostramos 5 dispositivos conectados o en transmisión
  const dispositivosActivos = dispositivos.filter(d => d.estado !== 'desconectado').slice(0, 5);

  simGrid.innerHTML = dispositivosActivos.map(d => `
    <div class="wear-sim-card">
      <div class="wear-sim-card__id">${d.id}</div>
      <div class="wear-sim-card__name">${d.empleado}</div>
      <div class="wear-sim-card__status">Transmitiendo...</div>
      <div class="wear-sim-card__packets">Paquetes: ${d.paquetes || '--'}</div>
    </div>
  `).join('');
}

/* RENDERIZAR TABLA DE DISPOSITIVOS */
function renderTabla() {
  tableBody.innerHTML = dispositivos.map(d => {

    /* Estado del dispositivo */
    const estadoClass = `wear-badge-${d.estado}`;
    const estadoLabel = d.estado === 'conectado' ? 'Conectado' :
                        d.estado === 'desconectado' ? 'Desconectado' : 'Advertencia';

    /* Estado BLE */
    const bleClass = `wear-ble-${d.ble}`;
    const bleLabel = d.ble === 'vinculado' ? 'Vinculado' : 'Buscando';

    /* Señal con ícono */
    let signalHTML = '';
    if (d.signal !== null) {
      signalHTML = `
        <div class="wear-signal">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span class="wear-signal__strength">${d.signal} dBm</span>
          <span class="wear-signal__quality">(${d.signalQuality})</span>
        </div>
      `;
    } else {
      signalHTML = `<div class="wear-signal"><span style="color:var(--text-muted)">--- (Sin señal)</span></div>`;
    }

    /* Barra de batería */
    const batClass = d.bateria < 20 ? '--critical' : d.bateria < 40 ? '--low' : '';
    const batteryHTML = d.bateria !== null
      ? `
        <div class="wear-battery">
          <div class="wear-battery__bar">
            <div class="wear-battery__fill ${batClass}" style="width: ${d.bateria}%"></div>
          </div>
          <span class="wear-battery__percent">${d.bateria}%</span>
        </div>
      `
      : `<div class="wear-battery"><span style="color:var(--text-muted)">--</span></div>`;

    return `
      <tr>
        <td style="color:var(--text-secondary); font-weight:500">${d.id}</td>
        <td>${d.empleado}</td>
        <td><span class="${estadoClass}">${estadoLabel}</span></td>
        <td><span class="${bleClass}">${bleLabel}</span></td>
        <td>${signalHTML}</td>
        <td>${batteryHTML}</td>
        <td style="color:var(--text-muted); font-size:0.82rem">${d.ultimaSinc}</td>
      </tr>
    `;
  }).join('');
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
actualizarKPIs();
renderSimulacion();
renderTabla();

/* Actualización simulada cada 5 segundos */
setInterval(() => {
  renderSimulacion();
}, 5000);