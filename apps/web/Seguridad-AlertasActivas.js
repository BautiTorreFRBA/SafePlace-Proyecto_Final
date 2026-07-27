const API_BASE_URL = 'http://localhost:8000/api/v1';
const tableBody = document.getElementById('alertTableBody');
const alertCount = document.getElementById('alertCount');
const filterTipo = document.getElementById('filterTipo');

let alertas = [];

async function cargarAlertas() {
  const res = await fetch(`${API_BASE_URL}/dashboard/alerts`);
  const json = await res.json();
  alertas = (json.data || []).map((a) => ({
    id: a.id,
    prioridad: (a.tipo_alerta || '').toLowerCase().includes('cr') ? 'critico' : 'advertencia',
    tipo: a.tipo_alerta || 'Alerta',
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    fecha: new Date(a.fecha_hora).toLocaleString('es-AR'),
    estado: a.estado || 'activo',
  }));
  actualizarContador();
  renderTabla();
}

function actualizarContador() {
  const total = alertas.length;
  alertCount.textContent = `${total} ${total === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
}

function renderTabla() {
  const filtro = filterTipo.value;
  const filtrados = filtro ? alertas.filter((a) => a.prioridad === filtro) : alertas;
  tableBody.innerHTML = filtrados.map((a) => `<tr>
      <td class="alert-td-prioridad"><span class="alert-badge-prioridad alert-badge-${a.prioridad}">${a.prioridad === 'critico' ? 'Crítico' : 'Advertencia'}</span></td>
      <td class="alert-td-tipo"><div class="alert-tipo alert-tipo--${a.prioridad}">${a.tipo}</div></td>
      <td class="alert-td-empleado">${a.empleado}</td>
      <td class="alert-td-fecha">${a.fecha}</td>
      <td class="alert-td-estado"><span class="alert-badge-estado alert-badge-${a.estado}">${a.estado}</span></td>
      <td class="alert-td-acciones"><div class="alert-actions"><button class="alert-btn alert-btn--ver" onclick="verAlerta(${a.id})">Ver</button><button class="alert-btn alert-btn--revisar" onclick="revisarAlerta(${a.id})">Revisar</button><button class="alert-btn alert-btn--cerrar" onclick="cerrarAlerta(${a.id})">Cerrar</button></div></td>
    </tr>`).join('');
}

window.verAlerta = (id) => alert(`Alerta ${id}`);
window.revisarAlerta = (id) => alert(`Revisar alerta ${id}`);
window.cerrarAlerta = (id) => alert(`Cerrar alerta ${id}`);
filterTipo.addEventListener('change', renderTabla);
cargarAlertas().catch(console.error);
