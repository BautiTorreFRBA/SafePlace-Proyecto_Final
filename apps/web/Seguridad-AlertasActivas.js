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
    idTrabajador: a.id_trabajador ?? null,
    fechaHora: a.fecha_hora,
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

window.cerrarAlerta = (id) => cambiarEstado(id, 'Cerrada');

// ── Modal "Revisar": FC del día del empleado ──────────────────────────────
// Mismo gráfico que el "Historial del empleado" del supervisor, acotado al día
// de la alerta, con el momento de la alerta marcado.
const UMBRALES_POR_DEFECTO = { fatiga: 130, sobreesfuerzo: 160 };
const fcModal = document.getElementById('fcModal');
const fcModalSubtitle = document.getElementById('fcModalSubtitle');
const fcModalStats = document.getElementById('fcModalStats');
const fcModalChart = document.getElementById('fcModalChart');
const fcModalAtender = document.getElementById('fcModalAtender');
let umbralesCache = null;
let fcModalAlertaId = null;

// YYYY-MM-DD del día de la alerta en hora argentina (el backend filtra por ese calendario).
const diaAR = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_AR }).format(date);

async function obtenerUmbrales() {
  if (umbralesCache) return umbralesCache;
  try {
    const payload = await apiFetch('/umbrales');
    const u = payload?.data || {};
    umbralesCache = {
      fatiga: Number(u.fc_fatiga) || UMBRALES_POR_DEFECTO.fatiga,
      sobreesfuerzo: Number(u.fc_sobreesfuerzo) || UMBRALES_POR_DEFECTO.sobreesfuerzo,
    };
  } catch (error) {
    console.error(error);
    umbralesCache = { ...UMBRALES_POR_DEFECTO };
  }
  return umbralesCache;
}

function renderStatsFc(puntos) {
  const lecturas = puntos.reduce((acc, p) => acc + p.lecturas, 0);
  const promedio = lecturas
    ? Math.round(puntos.reduce((acc, p) => acc + p.fcPromedio * p.lecturas, 0) / lecturas)
    : null;
  const min = puntos.length ? Math.min(...puntos.map((p) => p.fcMin)) : null;
  const max = puntos.length ? Math.max(...puntos.map((p) => p.fcMax)) : null;
  const stat = (label, valor, unidad = 'BPM') => `<div class="fc-modal__stat"><span>${label}</span><strong>${valor ?? '--'}${unidad && valor != null ? ` <small>${unidad}</small>` : ''}</strong></div>`;
  fcModalStats.innerHTML = stat('Promedio FC', promedio) + stat('Mínimo', min) + stat('Máximo', max) + stat('Lecturas', lecturas, '');
}

function renderGraficoFc(puntos, umbrales, momentoAlerta) {
  if (!puntos.length) {
    fcModalChart.innerHTML = '<div class="fc-modal__empty">No hay mediciones de frecuencia cardíaca para este empleado en el día.</div>';
    return;
  }
  const { fatiga, sobreesfuerzo } = umbrales;
  const valores = puntos.map((p) => p.fcPromedio);
  const min = Math.max(30, Math.floor(Math.min(...valores, fatiga) / 10) * 10 - 10);
  const max = Math.min(220, Math.ceil(Math.max(...valores, sobreesfuerzo) / 10) * 10 + 10);
  const width = 800; const height = 280; const left = 40; const right = 18; const top = 18; const bottom = 36;

  // Eje X por tiempo real (no por índice): los cortes de señal quedan como huecos visibles.
  const t0 = new Date(puntos[0].ts).getTime();
  const t1 = Math.max(new Date(puntos[puntos.length - 1].ts).getTime(), t0 + 60_000);
  const x = (t) => left + ((t - t0) / (t1 - t0)) * (width - left - right);
  const y = (v) => height - bottom - ((v - min) / Math.max(max - min, 1)) * (height - top - bottom);

  // Se corta la línea cuando hay más de 5 minutos sin lecturas.
  let linea = '';
  puntos.forEach((p, i) => {
    const t = new Date(p.ts).getTime();
    const salto = i === 0 || t - new Date(puntos[i - 1].ts).getTime() > 5 * 60_000;
    linea += `${salto ? 'M' : 'L'} ${x(t).toFixed(1)} ${y(p.fcPromedio).toFixed(1)} `;
  });

  const ticksY = Array.from({ length: 5 }, (_, i) => Math.round(min + ((max - min) * i) / 4));
  const ticksX = Array.from({ length: 6 }, (_, i) => t0 + ((t1 - t0) * i) / 5);
  const hora = (t) => fmtARHora(new Date(t), { hour: '2-digit', minute: '2-digit' });

  const tAlerta = momentoAlerta ? new Date(momentoAlerta).getTime() : NaN;
  const marcaAlerta = tAlerta >= t0 && tAlerta <= t1
    ? `<line class="fc-chart__alert" x1="${x(tAlerta)}" x2="${x(tAlerta)}" y1="${top}" y2="${height - bottom}" /><text class="fc-chart__label--alert" x="${x(tAlerta) + 4}" y="${top + 9}">Alerta ${hora(tAlerta)}</text>`
    : '';

  fcModalChart.innerHTML = `<svg class="fc-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Frecuencia cardíaca del día">
    ${ticksY.map((v) => `<line class="fc-chart__grid" x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}" /><text x="4" y="${y(v) + 4}">${v}</text>`).join('')}
    <line class="fc-chart__threshold" x1="${left}" x2="${width - right}" y1="${y(fatiga)}" y2="${y(fatiga)}" />
    <line class="fc-chart__threshold fc-chart__threshold--critical" x1="${left}" x2="${width - right}" y1="${y(sobreesfuerzo)}" y2="${y(sobreesfuerzo)}" />
    ${marcaAlerta}
    <path class="fc-chart__line" d="${linea}" />
    ${puntos.map((p) => `<circle class="fc-chart__point" cx="${x(new Date(p.ts).getTime())}" cy="${y(p.fcPromedio)}" r="2.5"><title>${p.fcPromedio} BPM · ${hora(p.ts)} · ${p.lecturas} lectura(s)</title></circle>`).join('')}
    ${ticksX.map((t) => `<text class="fc-chart__hour" x="${x(t)}" y="${height - 12}" text-anchor="middle">${hora(t)}</text>`).join('')}
    <text class="fc-chart__label--fatigue" x="${left + 5}" y="${y(fatiga) - 5}">Fatiga ${fatiga}</text>
    <text class="fc-chart__label--critical" x="${left + 5}" y="${y(sobreesfuerzo) - 5}">Sobreesfuerzo ${sobreesfuerzo}</text>
  </svg>`;
}

function cerrarModalFc() {
  fcModal.classList.remove('modal-overlay--visible');
  fcModal.setAttribute('aria-hidden', 'true');
  fcModalAlertaId = null;
}

window.revisarAlerta = async (id) => {
  const alerta = alertas.find((a) => a.id === id);
  if (!alerta) return;

  fcModalAlertaId = id;
  fcModalSubtitle.textContent = `${alerta.empleado} · ${alerta.tipo} · ${alerta.fecha} ${alerta.hora}`;
  fcModalStats.innerHTML = '';
  fcModalChart.innerHTML = '<div class="fc-modal__empty">Cargando mediciones del día...</div>';
  fcModal.classList.add('modal-overlay--visible');
  fcModal.setAttribute('aria-hidden', 'false');

  if (alerta.idTrabajador == null) {
    fcModalChart.innerHTML = '<div class="fc-modal__empty">La alerta no tiene un empleado asociado.</div>';
    return;
  }

  const fechaAlerta = new Date(alerta.fechaHora);
  const dia = diaAR(Number.isNaN(fechaAlerta.getTime()) ? new Date() : fechaAlerta);
  try {
    const [serie, umbrales] = await Promise.all([
      apiFetch(`/mediciones?desde=${dia}&hasta=${dia}&id_trabajador=${alerta.idTrabajador}&bucket=1m`),
      obtenerUmbrales(),
    ]);
    if (fcModalAlertaId !== id) return; // se cerró o se abrió otra alerta mientras cargaba
    const puntos = serie?.data || [];
    renderStatsFc(puntos);
    renderGraficoFc(puntos, umbrales, alerta.fechaHora);
  } catch (error) {
    if (fcModalAlertaId !== id) return;
    fcModalChart.innerHTML = `<div class="fc-modal__empty">${escapeHtml(error.message)}</div>`;
  }
};

fcModal.addEventListener('click', (event) => {
  if (event.target === fcModal || event.target.closest('[data-fc-close]')) cerrarModalFc();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && fcModal.classList.contains('modal-overlay--visible')) cerrarModalFc();
});
fcModalAtender.addEventListener('click', async () => {
  const id = fcModalAlertaId;
  if (id == null) return;
  cerrarModalFc();
  await cambiarEstado(id, 'Atendida');
});

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
