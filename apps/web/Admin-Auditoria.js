const API_BASE_URL = window.__SAFEPLACE_API_URL__ || (window.location.port === '5173'
  ? 'http://localhost:8000/api/v1'
  : '/api/v1');

const usuarioInput = document.getElementById('usuarioInput');
const operacionInput = document.getElementById('operacionInput');
const desdeInput = document.getElementById('desdeInput');
const hastaInput = document.getElementById('hastaInput');
const btnFiltrar = document.getElementById('btnFiltrar');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnAnterior = document.getElementById('btnAnterior');
const btnSiguiente = document.getElementById('btnSiguiente');
const tableBody = document.getElementById('auditoriaTableBody');
const auditoriaTotal = document.getElementById('auditoriaTotal');
const auditoriaPagina = document.getElementById('auditoriaPagina');

const LIMIT = 50;

let registros = [];
let total = 0;
let offset = 0;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function usuarioLabel(item) {
  if (item.id_usuario == null) return 'Sistema';

  const nombreCompleto = `${item.usuario_nombre || ''} ${item.usuario_apellido || ''}`.trim();
  if (nombreCompleto) return nombreCompleto;
  if (item.usuario_email) return item.usuario_email;
  return `Usuario ${item.id_usuario}`;
}

function recursoLabel(item) {
  const tabla = item.tabla_afectada || '--';
  if (item.id_registro == null) return tabla;
  return `${tabla} #${item.id_registro}`;
}

function dateParam(value, endOfDay = false) {
  if (!value) return '';
  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
}

function buildQuery() {
  const params = new URLSearchParams();
  const usuario = usuarioInput.value.trim();
  const operacion = operacionInput.value.trim();
  const desde = dateParam(desdeInput.value);
  const hasta = dateParam(hastaInput.value, true);

  if (usuario) params.set('usuario', usuario);
  if (operacion) params.set('operacion', operacion);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  params.set('limit', String(LIMIT));
  params.set('offset', String(offset));

  return params.toString();
}

function rowHTML(item) {
  return `<tr>
      <td>
        <div style="font-weight:600;">${escapeHtml(usuarioLabel(item))}</div>
        <div style="color:var(--text-muted); font-size:0.78rem;">${escapeHtml(item.usuario_email || (item.id_usuario == null ? '--' : `ID ${item.id_usuario}`))}</div>
      </td>
      <td style="color:var(--text-muted); font-size:0.82rem">${escapeHtml(formatDate(item.fecha_hora))}</td>
      <td><span class="badge badge--normal">${escapeHtml(item.operacion || '--')}</span></td>
      <td style="color:var(--text-secondary)">${escapeHtml(item.ip_origen || '--')}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(recursoLabel(item))}</td>
    </tr>`;
}

function renderAuditoria() {
  const paginaActual = Math.floor(offset / LIMIT) + 1;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMIT));

  auditoriaTotal.textContent = `${total} resultado${total === 1 ? '' : 's'} en auditoría`;
  auditoriaPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;

  tableBody.innerHTML = registros.length === 0
    ? '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No hay registros de auditoría para los filtros seleccionados</td></tr>'
    : registros.map((item) => rowHTML(item)).join('');

  btnAnterior.disabled = offset === 0;
  btnSiguiente.disabled = offset + LIMIT >= total;
}

async function cargarAuditoria() {
  btnFiltrar.disabled = true;
  btnLimpiar.disabled = true;
  btnAnterior.disabled = true;
  btnSiguiente.disabled = true;

  try {
    const payload = await apiFetch(`/auditoria?${buildQuery()}`);
    registros = payload.data || [];
    total = Number(payload.total || 0);
    offset = Number(payload.offset || offset);
    renderAuditoria();
  } finally {
    btnFiltrar.disabled = false;
    btnLimpiar.disabled = false;
    btnAnterior.disabled = offset === 0;
    btnSiguiente.disabled = offset + LIMIT >= total;
  }
}

function aplicarFiltros() {
  offset = 0;
  cargarAuditoria().catch((error) => {
    alert(error.message);
    renderAuditoria();
  });
}

function limpiarFiltros() {
  usuarioInput.value = '';
  operacionInput.value = '';
  desdeInput.value = '';
  hastaInput.value = '';
  offset = 0;
  cargarAuditoria().catch((error) => {
    alert(error.message);
    renderAuditoria();
  });
}

function paginaAnterior() {
  if (offset === 0) return;
  offset = Math.max(0, offset - LIMIT);
  cargarAuditoria().catch((error) => {
    alert(error.message);
    renderAuditoria();
  });
}

function paginaSiguiente() {
  if (offset + LIMIT >= total) return;
  offset += LIMIT;
  cargarAuditoria().catch((error) => {
    alert(error.message);
    renderAuditoria();
  });
}

btnFiltrar.addEventListener('click', aplicarFiltros);
btnLimpiar.addEventListener('click', limpiarFiltros);
btnAnterior.addEventListener('click', paginaAnterior);
btnSiguiente.addEventListener('click', paginaSiguiente);

[usuarioInput, operacionInput, desdeInput, hastaInput].forEach((input) => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') aplicarFiltros();
  });
});

renderAuditoria();
cargarAuditoria().catch((err) => {
  console.error(err);
  alert(err.message);
  tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se pudieron cargar los registros de auditoría</td></tr>';
});
