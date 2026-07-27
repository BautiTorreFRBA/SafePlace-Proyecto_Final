const API_BASE_URL = 'http://localhost:8000/api/v1';
const tableBody = document.getElementById('histTableBody');
const histCount = document.getElementById('histCount');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterTipo = document.getElementById('filterTipo');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');

let historicoAlertas = [];

async function cargarHistorial() {
  const params = new URLSearchParams();
  if (filterDesde.value) {
    params.set('desde', `${filterDesde.value}T00:00:00.000Z`);
  }
  const res = await fetch(`${API_BASE_URL}/dashboard/alerts?${params.toString()}`);
  const json = await res.json();
  historicoAlertas = (json.data || []).map((a) => ({
    severidad: (a.tipo_alerta || '').toLowerCase().includes('cr') ? 'critico' : 'advertencia',
    tipo: a.tipo_alerta || 'Alerta',
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    fecha: new Date(a.fecha_hora).toLocaleString('es-AR'),
    estado: a.estado || 'activo',
  }));
  renderTabla();
}

function actualizarContador(cantidad) {
  histCount.textContent = `${cantidad} ${cantidad === 1 ? 'registro encontrado' : 'registros encontrados'}`;
}

function renderTabla() {
  const empleado = filterEmpleado.value.toLowerCase();
  const tipo = filterTipo.value;
  const filtrados = historicoAlertas.filter((a) => (!empleado || a.empleado.toLowerCase().includes(empleado)) && (!tipo || a.tipo === tipo));
  actualizarContador(filtrados.length);
  tableBody.innerHTML = filtrados.map((a) => `<tr><td><span class="hist-badge-severidad hist-badge-${a.severidad}">${a.severidad}</span></td><td class="hist-td-tipo">${a.tipo}</td><td class="hist-td-empleado">${a.empleado}</td><td class="hist-td-fecha">${a.fecha}</td><td><span class="hist-badge-estado hist-badge-${a.estado}">${a.estado}</span></td></tr>`).join('');
}

filterEmpleado.addEventListener('input', renderTabla);
filterTipo.addEventListener('change', renderTabla);
filterDesde.addEventListener('change', () => cargarHistorial().catch(console.error));
btnPDF.addEventListener('click', () => alert('Exportar a PDF - Función simulada'));
btnExcel.addEventListener('click', () => alert('Exportar a Excel - Función simulada'));
cargarHistorial().catch(console.error);
