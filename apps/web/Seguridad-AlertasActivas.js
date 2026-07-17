/* BASE DE DATOS DE ALERTAS ACTIVAS*/
const alertas = [
  {
    id: 1,
    prioridad: 'critico',
    tipo: 'Sobresesfuerzo',
    empleado: 'Laura Rodríguez',
    fecha: '15/12/2024 14:28',
    estado: 'activo',
  },
  {
    id: 2,
    prioridad: 'advertencia',
    tipo: 'Fatiga',
    empleado: 'Ana Martínez',
    fecha: '15/12/2024 14:15',
    estado: 'activo',
  },
  {
    id: 3,
    prioridad: 'advertencia',
    tipo: 'Inactividad',
    empleado: 'Miguel Torres',
    fecha: '15/12/2024 13:45',
    estado: 'enrevision',
  },
  {
    id: 4,
    prioridad: 'advertencia',
    tipo: 'Fatiga',
    empleado: 'Valentina Díaz',
    fecha: '15/12/2024 14:00',
    estado: 'activo',
  },
];

/* REFERENCIAS AL DOM */
const tableBody = document.getElementById('alertTableBody');
const alertCount = document.getElementById('alertCount');
const filterTipo = document.getElementById('filterTipo');

/*  ACTUALIZAR CONTADOR*/
function actualizarContador() {
  const total = alertas.length;
  alertCount.textContent = `${total} ${total === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
}

/* RENDERIZAR TABLA DE ALERTAS */
function renderTabla() {
  const filtro = filterTipo.value;
  
  const filtrados = filtro 
    ? alertas.filter(a => a.prioridad === filtro)
    : alertas;

  tableBody.innerHTML = filtrados.map(a => {
    
    /* Badge de prioridad */
    const badgePrioridad = `alert-badge-${a.prioridad}`;
    const labelPrioridad = a.prioridad === 'critico' ? 'Crítico' : 'Advertencia';

    /* Ícono de tipo */
    const iconoTipo = a.prioridad === 'critico'
      ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
      : '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';

    const tipoClass = `alert-tipo--${a.prioridad}`;

    /* Badge de estado */
    const badgeEstado = `alert-badge-${a.estado}`;
    const labelEstado = a.estado === 'activo' ? 'Activo' 
                      : a.estado === 'enrevision' ? 'En revisión' 
                      : 'Cerrada';

    /* Botón Revisar: deshabilitado si está en revisión o cerrada */
    const revisarDisabled = a.estado !== 'activo' ? 'disabled' : '';

    return `
      <tr>
        <td class="alert-td-prioridad">
          <span class="alert-badge-prioridad ${badgePrioridad}">${labelPrioridad}</span>
        </td>
        <td class="alert-td-tipo">
          <div class="alert-tipo ${tipoClass}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${iconoTipo}
            </svg>
            ${a.tipo}
          </div>
        </td>
        <td class="alert-td-empleado">${a.empleado}</td>
        <td class="alert-td-fecha">${a.fecha}</td>
        <td class="alert-td-estado">
          <span class="alert-badge-estado ${badgeEstado}">${labelEstado}</span>
        </td>
        <td class="alert-td-acciones">
          <div class="alert-actions">
            <button class="alert-btn alert-btn--ver" onclick="verAlerta(${a.id})" title="Ver alerta">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="alert-btn alert-btn--revisar" onclick="revisarAlerta(${a.id})" ${revisarDisabled} title="Revisar alerta">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button class="alert-btn alert-btn--cerrar" onclick="cerrarAlerta(${a.id})" title="Cerrar alerta">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/*   ACCIONES  */

function verAlerta(id) {
  const alerta = alertas.find(a => a.id === id);
  if (alerta) {
    alert(`Ver alerta: ${alerta.tipo} de ${alerta.empleado}\n(Función simulada)`);
  }
}

function revisarAlerta(id) {
  const alerta = alertas.find(a => a.id === id);
  if (alerta && alerta.estado === 'activo') {
    alerta.estado = 'enrevision';
    renderTabla();
  }
}

function cerrarAlerta(id) {
  const alerta = alertas.find(a => a.id === id);
  if (alerta) {
    alerta.estado = 'cerrada';
    renderTabla();
  }
}

/* EVENTO DE FILTRO */
filterTipo.addEventListener('change', renderTabla);

/* INIT*/
actualizarContador();
renderTabla();