const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'http://localhost:8000/api/v1';

const fcFatigaInput = document.getElementById('fcFatigaInput');
const minutosFatigaInput = document.getElementById('minutosFatigaInput');
const fcSobreesfuerzoInput = document.getElementById('fcSobreesfuerzoInput');
const actividadSobreesfuerzoInput = document.getElementById('actividadSobreesfuerzoInput');
const minutosInactividadInput = document.getElementById('minutosInactividadInput');
const btnGuardar = document.getElementById('btnGuardar');
const umbralVigenteInfo = document.getElementById('umbralVigenteInfo');
const historialTableBody = document.getElementById('historialTableBody');

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

function rellenarFormulario(umbral) {
  fcFatigaInput.value = umbral.fc_fatiga;
  minutosFatigaInput.value = umbral.minutos_fatiga;
  fcSobreesfuerzoInput.value = umbral.fc_sobreesfuerzo;
  actividadSobreesfuerzoInput.value = umbral.actividad_sobreesfuerzo;
  minutosInactividadInput.value = umbral.minutos_inactividad;
}

function rowHTML(item) {
  return `<tr>
      <td style="color:var(--text-muted); font-size:0.82rem">${formatDate(item.fecha_hora)}</td>
      <td>${item.fc_fatiga} bpm</td>
      <td>${item.minutos_fatiga} min</td>
      <td>${item.fc_sobreesfuerzo} bpm</td>
      <td>${item.actividad_sobreesfuerzo}</td>
      <td>${item.minutos_inactividad} min</td>
    </tr>`;
}

function renderHistorial(historial) {
  historialTableBody.innerHTML = historial.length === 0
    ? '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">Todavía no se configuraron umbrales de riesgo</td></tr>'
    : historial.map((item) => rowHTML(item)).join('');
}

async function cargarVigenteEHistorial() {
  const [vigentePayload, historialPayload] = await Promise.all([
    apiFetch('/umbrales'),
    apiFetch('/umbrales/historial'),
  ]);

  const vigente = vigentePayload.data;
  if (vigente) {
    rellenarFormulario(vigente);
    umbralVigenteInfo.textContent = `Vigente desde ${formatDate(vigente.fecha_hora)}`;
  } else {
    umbralVigenteInfo.textContent = 'Todavía no hay umbrales configurados: el Motor de Reglas no genera alertas.';
  }

  renderHistorial(historialPayload.data || []);
}

async function guardarUmbrales() {
  const datos = {
    fcFatiga: Number(fcFatigaInput.value),
    minutosFatiga: Number(minutosFatigaInput.value),
    fcSobreesfuerzo: Number(fcSobreesfuerzoInput.value),
    actividadSobreesfuerzo: Number(actividadSobreesfuerzoInput.value),
    minutosInactividad: Number(minutosInactividadInput.value),
  };

  if (Object.values(datos).some((v) => !Number.isFinite(v) || v <= 0)) {
    alert('Completá los 5 valores con números positivos.');
    return;
  }

  try {
    btnGuardar.disabled = true;
    await apiFetch('/umbrales', {
      method: 'PUT',
      body: JSON.stringify(datos),
    });
    await cargarVigenteEHistorial();
  } catch (error) {
    alert(error.message);
  } finally {
    btnGuardar.disabled = false;
  }
}

btnGuardar.addEventListener('click', guardarUmbrales);

cargarVigenteEHistorial().catch((error) => {
  console.error(error);
  umbralVigenteInfo.textContent = 'No se pudo cargar la configuración de umbrales.';
  historialTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.875rem;">No se pudo cargar el historial</td></tr>';
});
