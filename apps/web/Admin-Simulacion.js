const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const tableBody = document.getElementById('simTableBody');
const count = document.getElementById('simCount');
const toggleButton = document.getElementById('btnToggleSim');
const statusDot = document.getElementById('simStatusDot');
const statusText = document.getElementById('simStatusText');
let simActiva = false;

function escapeHtml(value) {
  return String(value ?? '--').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; return null; }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudo obtener la información.');
  return payload;
}

function actualizarControlSimulacion() {
  toggleButton.disabled = false;
  toggleButton.textContent = simActiva ? 'Detener simulación' : 'Iniciar simulación';
  toggleButton.style.background = simActiva ? '#ef4444' : '';
  statusDot.className = `dot ${simActiva ? 'dot--green' : 'dot--gray'}`;
  statusText.textContent = simActiva ? 'Activa' : 'Inactiva';
}

function renderOperarios(operarios) {
  count.textContent = `${operarios.length} operario${operarios.length === 1 ? '' : 's'} incluido${operarios.length === 1 ? '' : 's'} en la simulación`;
  tableBody.innerHTML = operarios.length
    ? operarios.map((o) => `<tr><td><strong>${escapeHtml(o.nombre)}</strong></td><td>${escapeHtml(o.apellido)}</td><td class="emp-id">${escapeHtml(o.legajo)}</td><td>${escapeHtml(o.area)}</td><td>${escapeHtml(o.turno)}</td><td style="color:var(--text-secondary)">${escapeHtml([o.marca, o.modelo].filter(Boolean).join(' ') || 'Wearable')}<br><small>${escapeHtml(o.direccion_mac)}</small></td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No hay operarios con wearables de simulación asignados.</td></tr>';
}

async function cargar() {
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Cargando…</td></tr>';
  try {
    const [operarios, simulacion] = await Promise.all([apiFetch('/simulacion/operarios'), apiFetch('/simulacion')]);
    renderOperarios(operarios?.data || []);
    simActiva = Boolean(simulacion?.data?.activa);
    actualizarControlSimulacion();
    await cargarSlots();
  } catch (error) {
    count.textContent = 'No se pudo cargar la simulación';
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#fca5a5">${escapeHtml(error.message)}</td></tr>`;
    statusText.textContent = 'No disponible';
  }
}

// ---- Alta de operario con wearable del simulador ----

const slotSelect = document.getElementById('altaSlot');
const slotsInfo = document.getElementById('altaSlots');
const btnAlta = document.getElementById('btnAlta');

// Un wearable está libre si su última asignación no está vigente: sin mirar
// fecha_hasta, uno ya liberado seguiría apareciendo como ocupado.
function estaLibre(d) {
  if (d.operario_id == null) return true;
  return d.fecha_hasta != null && new Date(d.fecha_hasta) < new Date();
}

function aviso(texto, esError) {
  const el = document.getElementById('altaAviso');
  el.textContent = texto || '';
  el.style.color = esError ? '#fca5a5' : 'var(--text-secondary)';
}

async function cargarSlots() {
  try {
    const res = await apiFetch('/dashboard/devices');
    const libres = (res?.data || []).filter((d) => d.marca === 'SafePlace Sim' && estaLibre(d));
    slotSelect.innerHTML = libres.length
      ? libres.map((d) => `<option value="${d.id}">${escapeHtml(d.modelo)}</option>`).join('')
      : '<option value="">Sin wearables libres</option>';
    slotsInfo.textContent = `${libres.length} wearable${libres.length === 1 ? '' : 's'} del simulador libre${libres.length === 1 ? '' : 's'}`;
    btnAlta.disabled = libres.length === 0;
    if (!libres.length) aviso('No quedan wearables del simulador libres. Liberá uno desde Wearables o cargá otro dispositivo con marca "SafePlace Sim".', true);
    else aviso('');
  } catch (error) {
    slotsInfo.textContent = 'No se pudieron cargar los wearables libres';
    aviso(error.message, true);
  }
}

btnAlta.addEventListener('click', async () => {
  const nombre = document.getElementById('altaNombre').value.trim();
  const apellido = document.getElementById('altaApellido').value.trim();
  const idDispositivo = slotSelect.value;
  if (!nombre || !apellido) return aviso('Nombre y apellido son obligatorios.', true);
  if (!idDispositivo) return aviso('No hay wearable libre para asignar.', true);

  btnAlta.disabled = true;
  aviso('Creando…');
  try {
    const creado = await apiFetch('/dashboard/employees', {
      method: 'POST',
      body: JSON.stringify({
        nombre,
        apellido,
        area: document.getElementById('altaArea').value,
        turno: document.getElementById('altaTurno').value,
      }),
    });
    const idTrabajador = creado?.data?.id ?? creado?.id;
    if (!idTrabajador) throw new Error('El alta no devolvió el id del operario.');

    // Sin la asignación el operario existe pero el simulador no emite para él.
    await apiFetch('/asociaciones', {
      method: 'POST',
      body: JSON.stringify({ idTrabajador, idDispositivo: Number(idDispositivo) }),
    });

    document.getElementById('altaNombre').value = '';
    document.getElementById('altaApellido').value = '';
    await cargar();
    aviso(`${nombre} ${apellido} agregado. Entra a la simulación en el próximo ciclo (hasta 15 s).`);
  } catch (error) {
    aviso(error.message, true);
    btnAlta.disabled = false;
  }
});

document.getElementById('refreshBtn').addEventListener('click', cargar);
toggleButton.addEventListener('click', async () => {
  toggleButton.disabled = true;
  try {
    const response = await apiFetch('/simulacion', {
      method: 'PUT',
      body: JSON.stringify({ activa: !simActiva }),
    });
    simActiva = Boolean(response?.data?.activa ?? !simActiva);
    actualizarControlSimulacion();
  } catch (error) {
    alert(`Error al cambiar estado de simulación: ${error.message}`);
    actualizarControlSimulacion();
  }
});
cargar();
