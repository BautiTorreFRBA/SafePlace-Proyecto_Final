const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';

// H0015: bandeja "en tiempo cercano al real" — polling simple (no hay
// WebSockets/SSE en el proyecto).
const POLL_INTERVAL_MS = 20000;

const tableBody = document.getElementById('alertTableBody');
const alertCount = document.getElementById('alertCount');
let alertas = [];
const severidadesActivas = new Set(['critico', 'advertencia']);
const tiposActivos = new Set(['FATIGA', 'INACTIVIDAD_PROLONGADA', 'SOBREESFUERZO']);

const ETIQUETA_TIPO_ALERTA = {
  FATIGA: 'Fatiga',
  SOBREESFUERZO: 'Sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'Inactividad prolongada (wearable desconectado)',
};
const etiquetaTipo = (t) => ETIQUETA_TIPO_ALERTA[t] || t || 'Alerta';
const claseTipo = (t) => ({
  FATIGA: 'fatiga',
  SOBREESFUERZO: 'sobreesfuerzo',
  INACTIVIDAD_PROLONGADA: 'inactividad',
}[String(t || '').toUpperCase()] || '');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizarAlerta(a) {
  const estado = a.estado || 'Activa';
  const estadoNormalizado = String(estado).toLowerCase();
  return {
    id: a.id,
    prioridad: (a.prioridad || '').toLowerCase().includes('cr') ? 'critico' : 'advertencia',
    tipoAlerta: String(a.tipo_alerta || '').trim().toUpperCase(),
    tipo: etiquetaTipo(a.tipo_alerta),
    claseTipo: claseTipo(a.tipo_alerta),
    empleado: `${a.operario_nombre || ''} ${a.operario_apellido || ''}`.trim() || '--',
    ...separarFechaHora(a.fecha_hora),
    estado,
    estadoClase: estadoNormalizado.includes('cerr') || estadoNormalizado.includes('atend') || estadoNormalizado.includes('resuel')
      ? 'cerrada'
      : estadoNormalizado.includes('rev') ? 'enrevision' : 'activo',
  };
}

function separarFechaHora(value) {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return { fecha: '--', hora: '--' };
  return {
    fecha: fmtARFecha(fecha),
    hora: fmtARHora(fecha, { hour: '2-digit', minute: '2-digit' }),
  };
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

async function cargarAlertas() {
  const payload = await apiFetch('/alertas/activas');
  alertas = (payload.data || []).map(normalizarAlerta).sort((a, b) => {
    const prioridad = { critico: 0, advertencia: 1 };
    return prioridad[a.prioridad] - prioridad[b.prioridad];
  });
  actualizarContador();
  renderTabla();
}

function actualizarContador() {
  const total = alertas.filter((a) => a.estadoClase !== 'cerrada').length;
  alertCount.textContent = `${total} ${total === 1 ? 'alerta pendiente' : 'alertas pendientes'}`;
}

function renderTabla() {
  const filtrados = alertas.filter((a) => {
    const coincideSeveridad = severidadesActivas.has(a.prioridad);
    const coincideTipo = tiposActivos.has(a.tipoAlerta);
    const coincideEstado = a.estadoClase !== 'cerrada';
    return coincideSeveridad && coincideTipo && coincideEstado;
  });
  tableBody.innerHTML = filtrados.length ? filtrados.map((a) => `<tr>
      <td class="alert-td-prioridad"><span class="alert-badge-prioridad alert-badge-${a.prioridad}">${a.prioridad === 'critico' ? 'Crítica' : 'Media'}</span></td>
      <td class="alert-td-tipo"><div class="alert-tipo">${escapeHtml(a.tipo)}</div></td>
      <td class="alert-td-empleado">${escapeHtml(a.empleado)}</td>
      <td class="alert-td-fecha">${escapeHtml(a.fecha)}</td>
      <td class="alert-td-hora">${escapeHtml(a.hora)}</td>
      <td class="alert-td-estado"><span class="alert-badge-estado alert-badge-${a.estadoClase}">${escapeHtml(a.estado)}</span></td>
      <td class="alert-td-acciones">${a.estadoClase === 'cerrada' ? '<span class="alert-action-done">Resuelta</span>' : `<div class="alert-actions"><button class="alert-btn alert-btn--revisar" onclick="revisarAlerta(${a.id})">Revisar</button><button class="alert-btn alert-btn--cerrar" onclick="cerrarAlerta(${a.id})">Cerrar</button></div>`}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="alert-empty">No hay alertas para los filtros seleccionados.</td></tr>';
}

async function cambiarEstado(id, estado) {
  try {
    await apiFetch(`/alertas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    await cargarAlertas();
  } catch (error) {
    alert(error.message);
  }
}

window.revisarAlerta = (id) => cambiarEstado(id, 'Atendida');
window.cerrarAlerta = (id) => cambiarEstado(id, 'Cerrada');

document.querySelectorAll('.alert-severity-filter').forEach((button) => {
  button.addEventListener('click', () => {
    const severidad = button.dataset.severidad;
    if (severidadesActivas.has(severidad)) {
      severidadesActivas.delete(severidad);
    } else {
      severidadesActivas.add(severidad);
    }
    button.classList.toggle('is-active', severidadesActivas.has(severidad));
    button.setAttribute('aria-pressed', String(severidadesActivas.has(severidad)));
    renderTabla();
  });
});
document.querySelectorAll('.alert-type-filter').forEach((button) => {
  button.addEventListener('click', () => {
    const tipo = button.dataset.tipo;
    if (tiposActivos.has(tipo)) {
      tiposActivos.delete(tipo);
    } else {
      tiposActivos.add(tipo);
    }
    button.classList.toggle('is-active', tiposActivos.has(tipo));
    button.setAttribute('aria-pressed', String(tiposActivos.has(tipo)));
    renderTabla();
  });
});

cargarAlertas().catch((error) => {
  console.error(error);
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px;">No se pudieron cargar las alertas activas</td></tr>';
});
setInterval(() => cargarAlertas().catch((error) => console.error(error)), POLL_INTERVAL_MS);
