/* ============================================================
   SAFEPLACE – MONITOREO.JS
   ------------------------------------------------------------
   Maneja la pantalla de Monitoreo en Tiempo Real:
     1. Datos simulados de trabajadores con métricas biométricas
     2. Render de la tabla con colores según estado
     3. Actualización automática cada 10 segundos (polling)
     4. Botón "Actualizar" con animación de spinner
     5. KPIs calculados dinámicamente desde los datos
   ============================================================ */


/* ------------------------------------------------------------
   1. DATOS SIMULADOS
   ------------------------------------------------------------
   Cada trabajador tiene:
     bpm        → frecuencia cardíaca actual (null = desconectado)
     actividad  → nivel de actividad física
     temp       → temperatura corporal
     spo2       → saturación de oxígeno
     estado     → 'normal' | 'warning' | 'critical' | 'disconnected'
     hora       → última actualización del dispositivo
   ------------------------------------------------------------ */
const trabajadores = [
  { id: 'JP', nombre: 'Juan Pérez',      bpm: 75,  actividad: 'Moderada',     temp: '36.5°C', spo2: '98%', estado: 'normal',       hora: null },
  { id: 'AM', nombre: 'Ana Martínez',    bpm: 113, actividad: 'Alta',         temp: '37.2°C', spo2: '96%', estado: 'warning',      hora: null },
  { id: 'PL', nombre: 'Pedro López',     bpm: 70,  actividad: 'Baja',         temp: '36.3°C', spo2: '99%', estado: 'normal',       hora: null },
  { id: 'LR', nombre: 'Laura Rodríguez', bpm: 134, actividad: 'Alta',         temp: '37.9°C', spo2: '94%', estado: 'critical',     hora: null },
  { id: 'SH', nombre: 'Sofía Herrera',   bpm: 83,  actividad: 'Moderada',     temp: '36.7°C', spo2: '97%', estado: 'normal',       hora: null },
  { id: 'MT', nombre: 'Miguel Torres',   bpm: null, actividad: 'Sin actividad', temp: null,    spo2: null,  estado: 'disconnected', hora: '13:15:00' },
  { id: 'VD', nombre: 'Valentina Díaz',  bpm: 90,  actividad: 'Moderada',     temp: '36.9°C', spo2: '97%', estado: 'normal',       hora: null },
];


/* ------------------------------------------------------------
   2. CONFIGURACIÓN DE BADGES Y COLORES POR ESTADO
   ------------------------------------------------------------ */
const ESTADO_CONFIG = {
  normal:       { cls: 'badge--normal',       label: '● Normal' },
  warning:      { cls: 'badge--warning',       label: '● Advertencia' },
  critical:     { cls: 'badge--critical',      label: '● Crítico' },
  disconnected: { cls: 'badge--disconnected',  label: '● Desconectado' },
};

// Color del BPM según estado del trabajador
const BPM_COLOR = {
  normal:       'bpm-value--normal',
  warning:      'bpm-value--warning',
  critical:     'bpm-value--critical',
  disconnected: 'bpm-value--normal',
};


/* ------------------------------------------------------------
   3. OBTENER HORA ACTUAL FORMATEADA HH:MM:SS
   ------------------------------------------------------------ */
function horaActual() {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}


/* ------------------------------------------------------------
   4. RENDER DE LA TABLA
   ------------------------------------------------------------ */
function renderTabla() {
  const tbody = document.getElementById('monTableBody');
  const ahora = horaActual();

  tbody.innerHTML = trabajadores.map(t => {

    const { cls, label } = ESTADO_CONFIG[t.estado];
    const bpmColor       = BPM_COLOR[t.estado];

    // Si el dispositivo está desconectado mostramos "---"
    const bpmHTML = t.bpm !== null
      ? `<div class="mon-metric">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${t.estado === 'critical' ? 'var(--red)' : t.estado === 'warning' ? 'var(--orange)' : 'var(--teal-400)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
             <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
           </svg>
           <span class="bpm-value ${bpmColor}">${t.bpm}</span>&nbsp;BPM
         </div>`
      : `<div class="mon-metric">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
             <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
           </svg>
           <span style="color:var(--text-muted)">---</span>
         </div>`;

    const tempHTML = t.temp !== null
      ? `<div class="mon-metric">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
             <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
           </svg>
           ${t.temp}
         </div>`
      : `<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>`;

    const spo2HTML = t.spo2 !== null
      ? `<div class="mon-metric">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
             <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/>
             <path d="M12 6v6l4 2"/>
           </svg>
           ${t.spo2}
         </div>`
      : `<div class="mon-metric"><span style="color:var(--text-muted)">---</span></div>`;

    // La hora de desconectados es fija; los activos muestran la hora actual
    const horaFila = t.estado === 'disconnected' ? t.hora : ahora;

    return `
      <tr>
        <td>
          <div class="mon-emp">
            <div class="avatar avatar--sm">${t.id}</div>
            <span class="mon-emp__name">${t.nombre}</span>
          </div>
        </td>
        <td>${bpmHTML}</td>
        <td style="color:var(--text-secondary)">${t.actividad}</td>
        <td>${tempHTML}</td>
        <td>${spo2HTML}</td>
        <td><span class="badge ${cls}">${label}</span></td>
        <td style="color:var(--text-muted); font-size:0.82rem">${horaFila}</td>
      </tr>
    `;
  }).join('');
}


/* ------------------------------------------------------------
   5. ACTUALIZAR KPIs
   ------------------------------------------------------------
   Calcula los valores de las 4 tarjetas superiores a partir
   del array de trabajadores para que sean siempre coherentes.
   ------------------------------------------------------------ */
function actualizarKPIs() {
  const activos   = trabajadores.filter(t => t.estado !== 'disconnected').length;
  const alertas   = trabajadores.filter(t => t.estado === 'warning' || t.estado === 'critical').length;
  const criticos  = trabajadores.filter(t => t.estado === 'critical').length;
  const conectados= trabajadores.filter(t => t.estado !== 'disconnected').length;
  const total     = trabajadores.length;

  document.getElementById('kpiTrabajadores').textContent = activos;
  document.getElementById('kpiAlertas').textContent      = alertas;
  document.getElementById('kpiCritico').textContent      = criticos;
  document.getElementById('kpiDispositivos').textContent = `${conectados}/${total}`;

  // Actualizamos también el badge de la campana con el total de alertas
  document.getElementById('notifBadge').textContent = alertas;
}


/* ------------------------------------------------------------
   6. FUNCIÓN DE ACTUALIZACIÓN COMPLETA
   ------------------------------------------------------------ */
function actualizarPantalla() {
  renderTabla();
  actualizarKPIs();
  document.getElementById('lastUpdate').textContent = horaActual();
}


/* ------------------------------------------------------------
   7. BOTÓN "ACTUALIZAR" CON ANIMACIÓN
   ------------------------------------------------------------ */
document.getElementById('btnActualizar').addEventListener('click', function () {
  // Agregamos clase que dispara la animación CSS de rotación
  this.classList.add('spinning');

  // Quitamos la clase al terminar la animación para poder volver a usarla
  this.addEventListener('animationend', () => {
    this.classList.remove('spinning');
  }, { once: true });

  actualizarPantalla();
});


/* ------------------------------------------------------------
   8. POLLING AUTOMÁTICO CADA 10 SEGUNDOS
   ------------------------------------------------------------
   Simula la recepción de datos en tiempo real.
   En producción esto se reemplazaría por un WebSocket:
     const ws = new WebSocket('wss://api.safeplace.com/monitor');
     ws.onmessage = (e) => { Object.assign(trabajadores, JSON.parse(e.data)); actualizarPantalla(); };
   ------------------------------------------------------------ */
setInterval(actualizarPantalla, 10_000);


/* ------------------------------------------------------------
   9. INIT
   ------------------------------------------------------------ */
actualizarPantalla();