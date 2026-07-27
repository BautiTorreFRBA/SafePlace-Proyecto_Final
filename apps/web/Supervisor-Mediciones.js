const API_BASE_URL = 'http://localhost:8000/api/v1';
const tableBody = document.getElementById('medTableBody');
const medCount = document.getElementById('medCount');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterDesde = document.getElementById('filterDesde');
const filterHasta = document.getElementById('filterHasta');
const btnPDF = document.getElementById('btnPDF');
const btnExcel = document.getElementById('btnExcel');

let mediciones = [];

async function cargarEmpleados() {
  const res = await fetch(`${API_BASE_URL}/dashboard/employees`);
  const json = await res.json();
  filterEmpleado.innerHTML = '<option value="">Todos</option>' + (json.data || [])
    .map((emp) => `<option value="${emp.nombre} ${emp.apellido}">${emp.nombre} ${emp.apellido}</option>`).join('');
}

async function cargarMediciones() {
  const params = new URLSearchParams();
  if (filterDesde.value) params.set('desde', `${filterDesde.value}T00:00:00.000Z`);
  if (filterHasta.value) params.set('hasta', `${filterHasta.value}T23:59:59.999Z`);
  params.set('limit', '200');
  const res = await fetch(`${API_BASE_URL}/dashboard/measurements?${params.toString()}`);
  const json = await res.json();
  mediciones = (json.data || []).map((m) => ({
    empleado: `${m.operario_nombre || ''} ${m.operario_apellido || ''}`.trim() || `ID ${m.id_trabajador}`,
    fecha: new Date(m.fecha_hora).toISOString().slice(0, 10),
    hora: new Date(m.fecha_hora).toISOString().slice(11, 16),
    bpm: m.frecuencia_cardiaca,
    actividad: m.actividad || '--',
    temp: m.temperatura_corporal ?? '--',
    spo2: m.spo2 ?? '--',
    valido: m.estado ? 'Sí' : 'No',
  }));
  renderTabla();
}

function renderTabla() {
  const empleado = filterEmpleado.value;
  const desde = filterDesde.value;
  const hasta = filterHasta.value;
  const filtrados = mediciones.filter((m) => {
    const matchEmpleado = !empleado || m.empleado === empleado;
    const matchFecha = (!desde || m.fecha >= desde) && (!hasta || m.fecha <= hasta);
    return matchEmpleado && matchFecha;
  });
  medCount.textContent = `${filtrados.length}/${mediciones.length} registros`;
  tableBody.innerHTML = filtrados.length === 0
    ? '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">No hay mediciones que coincidan con los filtros</td></tr>'
    : filtrados.map((m) => `<tr>
        <td>${m.empleado}</td>
        <td style="color:var(--text-muted); font-size:0.82rem">${m.fecha} ${m.hora}</td>
        <td><span class="med-fc-value">${m.bpm}</span></td>
        <td style="color:var(--text-secondary)">${m.actividad}</td>
        <td style="color:var(--text-secondary)">${m.temp}</td>
        <td style="color:var(--text-secondary)">${m.spo2}</td>
        <td><span class="${m.valido === 'Sí' ? 'med-valid-si' : 'med-valid-no'}">${m.valido}</span></td>
      </tr>`).join('');
}

function actualizarGraficas(datos) {
  const ctxFc = document.getElementById('chartFrecuencia').getContext('2d');
  if (window.chartFc) window.chartFc.destroy();
  window.chartFc = new Chart(ctxFc, {
    type: 'line',
    data: { labels: datos.map((_, i) => `${i + 1}`), datasets: [{ label: 'BPM', data: datos.map((d) => d.bpm), borderColor: '#2dd4bf', backgroundColor: 'rgba(45, 212, 191, 0.1)', tension: 0.4, fill: true, pointRadius: 2, pointBackgroundColor: '#2dd4bf' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
  const ctxVolumen = document.getElementById('chartVolumen').getContext('2d');
  if (window.chartVolumen) window.chartVolumen.destroy();
  window.chartVolumen = new Chart(ctxVolumen, {
    type: 'line',
    data: { labels: datos.map((_, i) => `${i + 1}`), datasets: [{ label: 'Lecturas', data: datos.map(() => 6), borderColor: '#2dd4bf', backgroundColor: 'rgba(45, 212, 191, 0.2)', fill: true, pointRadius: 0, tension: 0.1, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
}

btnPDF.addEventListener('click', () => alert('Exportar a PDF - Función simulada.'));
btnExcel.addEventListener('click', () => alert('Exportar a Excel - Función simulada.'));
filterEmpleado.addEventListener('change', renderTabla);
filterDesde.addEventListener('change', cargarMediciones);
filterHasta.addEventListener('change', cargarMediciones);

async function init() {
  await cargarEmpleados();
  await cargarMediciones();
  actualizarGraficas(mediciones);
}

init().catch(console.error);
