const API_BASE_URL = window.__SAFEPLACE_API_URL__ || 'https://safeplace-backend-9vhx.onrender.com/api/v1';
const btnGuardar = document.getElementById('btnGuardar');
const savedMessage = document.getElementById('cfgSaved');
const input = (id) => document.getElementById(id);
const numberValue = (id) => Number(input(id).value);

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; return null; }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || `Error HTTP ${response.status}`);
  return payload;
}

function reglasDesdeFormulario() {
  return {
    FATIGA: {
      fcMin: numberValue('fcMin'), fcMax: numberValue('fcMax'), fcCritico: numberValue('fcCritico'),
      variabilidadFc: numberValue('fatVariabilidad'), decliveActividad: numberValue('fatDeclive'),
      horasConsecutivas: numberValue('fatHoras'),
    },
    INACTIVIDAD: {
      maxInactividad: numberValue('inacMax'), alertaDespues: numberValue('inacAlerta'),
      maxIntensidadAlta: numberValue('actMax'), intervaloDescanso: numberValue('actDescanso'),
    },
    SOBREESFUERZO: {
      fcSostenidaMin: numberValue('sobreFc'), umbralFc: numberValue('sobreUmbral'),
      nivelActividad: input('sobreNivel').value,
    },
  };
}

function aplicarReglas(registros) {
  const reglas = Object.fromEntries((registros || []).map((item) => [item.tipo, item.parametros || {}]));
  const fatiga = reglas.FATIGA || {};
  const inactividad = reglas.INACTIVIDAD || {};
  const sobreesfuerzo = reglas.SOBREESFUERZO || {};
  Object.entries({
    fcMin: fatiga.fcMin, fcMax: fatiga.fcMax, fcCritico: fatiga.fcCritico,
    fatVariabilidad: fatiga.variabilidadFc, fatDeclive: fatiga.decliveActividad,
    fatHoras: fatiga.horasConsecutivas, inacMax: inactividad.maxInactividad,
    inacAlerta: inactividad.alertaDespues, actMax: inactividad.maxIntensidadAlta,
    actDescanso: inactividad.intervaloDescanso, sobreFc: sobreesfuerzo.fcSostenidaMin,
    sobreUmbral: sobreesfuerzo.umbralFc,
  }).forEach(([id, value]) => { if (value != null) input(id).value = value; });
  if (sobreesfuerzo.nivelActividad) input('sobreNivel').value = sobreesfuerzo.nivelActividad;
}

async function cargarConfiguracion() {
  const payload = await apiFetch('/reglas-alerta');
  aplicarReglas(payload.data);
}

async function guardarConfiguracion() {
  const reglas = reglasDesdeFormulario();
  const valores = Object.entries(reglas).flatMap(([tipo, parametros]) => Object.entries(parametros)
    .filter(([nombre]) => !(tipo === 'SOBREESFUERZO' && nombre === 'nivelActividad'))
    .map(([, valor]) => valor));
  if (valores.some((valor) => !Number.isFinite(valor) || valor <= 0)) {
    alert('Todos los valores numéricos deben ser positivos.'); return;
  }
  if (!['high', 'medium', 'low'].includes(reglas.SOBREESFUERZO.nivelActividad)) {
    alert('Seleccioná un nivel de actividad válido.'); return;
  }
  try {
    btnGuardar.disabled = true;
    await apiFetch('/reglas-alerta', { method: 'PUT', body: JSON.stringify({ reglas }) });
    savedMessage.textContent = '✓ Guardado en la base de datos';
    savedMessage.classList.add('cfg-saved--visible');
    setTimeout(() => savedMessage.classList.remove('cfg-saved--visible'), 2500);
  } catch (error) { alert(error.message); }
  finally { btnGuardar.disabled = false; }
}

document.querySelectorAll('.cfg-spinner__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = input(btn.dataset.target);
    const step = Number(target.step) || 1;
    target.value = btn.dataset.dir === 'up' ? Number(target.value) + step : Math.max(0, Number(target.value) - step);
  });
});
btnGuardar.addEventListener('click', guardarConfiguracion);
cargarConfiguracion().catch((error) => alert(`No se pudo cargar la configuración: ${error.message}`));
