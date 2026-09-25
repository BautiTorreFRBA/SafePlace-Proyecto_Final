import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './supervisor-empleados.css';

const API_BASE_URL = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  ? 'http://localhost:8000/api/v1'
  : 'https://safeplace-backend-9vhx.onrender.com/api/v1';

const toISODate = (date) => date.toISOString().slice(0, 10);
const today = new Date();
const defaultHasta = toISODate(today);
const defaultDesde = toISODate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));

async function apiFetch(path) {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'InicioSesion.html'; throw new Error('Sesión expirada.'); }
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'No se pudo cargar la información.');
  return payload;
}

function initials(name) { return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SP'; }
function fullName(item) { return `${item.nombre || item.operario_nombre || ''} ${item.apellido || item.operario_apellido || ''}`.trim() || 'Sin nombre'; }
function sessionUser() {
  const rawName = sessionStorage.getItem('userName') || '';
  const name = rawName.trim() ? rawName.trim().split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ') : 'Usuario';
  const role = String(sessionStorage.getItem('userRole') || '').trim().toLowerCase();
  const roleLabels = { admin: 'Administrador', supervisor: 'Supervisor Operativo', seguridad: 'Resp. Seguridad e Higiene' };
  return { name, role: roleLabels[role] || 'Usuario', initials: initials(name) };
}
function SessionUserUI() {
  useEffect(() => {
    const user = sessionUser();
    document.querySelectorAll('.sidebar__user-name').forEach((element) => { element.textContent = user.name; });
    document.querySelectorAll('.sidebar__user-role').forEach((element) => { element.textContent = user.role; });
    document.querySelectorAll('.sidebar__footer .avatar, .topbar__right .avatar').forEach((element) => { element.textContent = user.initials; });
  }, []);
  return null;
}
function formatDate(value) { if (!value) return 'Sin datos'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Sin datos' : date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function formatDateShort(value) { if (!value) return '--'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }); }

function MenuIcon({ type }) {
  const paths = {
    home: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    monitor: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    employees: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    measurements: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>,
    wearable: <><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></>,
    processing: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    notifications: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  };
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
}

function Sidebar() {
  const user = sessionUser();
  const links = [['home', 'Home', 'Supervisor-Home.html'], ['monitor', 'Monitoreo', 'Supervisor-Monitoreo.html'], ['employees', 'Empleados', 'Supervisor-Empleados.html'], ['measurements', 'Mediciones', 'Supervisor-Mediciones.html'], ['wearable', 'Wearables', 'Supervisor-Wearables.html'], ['processing', 'Procesamiento', 'Supervisor-Procesamiento.html'], ['notifications', 'Notificaciones', 'Supervisor-Notificaciones.html']];
  return <aside className="sidebar"><div className="sidebar__brand"><div className="sidebar__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div><div className="sidebar__name">SafePlace</div><div className="sidebar__sub">BIOMETRIC MONITOR</div></div></div><nav className="sidebar__nav">{links.map(([icon, label, href]) => <a className={`nav-item ${label === 'Empleados' ? 'nav-item--active' : ''}`} href={href} key={label}><MenuIcon type={icon} /> {label}</a>)}</nav><div className="sidebar__footer"><div className="sidebar__user"><div className="avatar avatar--sm"></div><div><div className="sidebar__user-name">Supervisor</div><div className="sidebar__user-role">Supervisor</div></div></div><a className="sidebar__logout" href="InicioSesion.html"><MenuIcon type="monitor" /> Cerrar sesión</a></div></aside>;
}

function Layout({ children, selected, onBack }) {
  return <div className="app empleados-page"><Sidebar /><main className="main"><header className="topbar"><div className="topbar__title">{selected ? 'Historial del empleado' : 'Empleados'}</div><div className="topbar__right"><div className="status-dot"><span className="dot dot--green"></span> En línea</div><div className="avatar"></div></div></header>{selected && <button className="empleado-back" onClick={onBack}><span>←</span> Volver a empleados</button>}{children}</main></div>;
}

const turnoLabel = (turno) => turno.charAt(0).toUpperCase() + turno.slice(1);

function EmployeeCard({ employee, onClick }) {
  const noData = !employee.lecturas;
  const risk = (employee.alertasTotal || 0) > 0 || (employee.fcMax || 0) >= 160;
  return <button className={`empleado-card ${risk ? 'empleado-card--risk' : ''} ${noData ? 'empleado-card--no-data' : ''}`} onClick={onClick}>
    <div className="empleado-card__top"><div className="empleado-avatar">{initials(fullName(employee))}</div><div className="empleado-card__identity"><h2>{fullName(employee)}</h2><p>{employee.legajo || 'Sin legajo'} · {employee.area || 'Sin área'}{employee.turno ? ` · Turno ${employee.turno}` : ''}</p></div><span className={`empleado-card__tag ${noData ? 'empleado-card__tag--empty' : risk ? 'empleado-card__tag--risk' : ''}`}>{noData ? 'Sin datos' : risk ? 'Revisar' : 'Historial'}</span></div>
    <div className="empleado-card__metrics"><div className="empleado-card__metric"><span>Promedio FC</span><strong>{employee.fcPromedio ?? '--'} <small>BPM</small></strong></div><div className="empleado-card__metric"><span>Mín / Máx</span><strong>{employee.fcMin ?? '--'} / {employee.fcMax ?? '--'}</strong></div><div className="empleado-card__metric"><span>Alertas</span><strong>{employee.alertasTotal || 0}</strong></div></div>
    <div className="empleado-card__footer"><span>{employee.lecturas ? `${employee.lecturas} lecturas` : 'No hay mediciones en el período'}</span><span>{employee.ultima ? `Última: ${formatDate(employee.ultima)}` : 'Abrir detalle →'}</span></div>
  </button>;
}

function ListView({ employees, loading, error, filters, setFilters, onSearch, onSelect }) {
  const areas = [...new Set(employees.map((item) => item.area).filter(Boolean))].sort();
  const turnos = ['mañana', 'tarde', 'noche'];
  const filtered = useMemo(() => employees.filter((item) => {
    const matchesSearch = fullName(item).toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()) || String(item.legajo || '').toLocaleLowerCase().includes(filters.search.toLocaleLowerCase());
    return matchesSearch && (!filters.area || item.area === filters.area) && (!filters.turno || item.turno === filters.turno);
  }).sort((a, b) => (b.alertasTotal || 0) - (a.alertasTotal || 0) || (b.fcMax || 0) - (a.fcMax || 0) || fullName(a).localeCompare(fullName(b))), [employees, filters]);
  // Agrupado por área y turno, como "Horarios laborales" del administrador. Se
  // muestran los turnos que tiene cada área (aunque el filtro los deje vacíos)
  // y, dentro de cada grupo, se mantiene el orden por riesgo.
  const groups = useMemo(() => {
    const byArea = new Map();
    employees.forEach((item) => {
      const area = item.area || 'Sin área'; const turno = String(item.turno || '').toLowerCase() || 'sin turno';
      if (!byArea.has(area)) byArea.set(area, new Map());
      if (!byArea.get(area).has(turno)) byArea.get(area).set(turno, []);
    });
    filtered.forEach((item) => { byArea.get(item.area || 'Sin área').get(String(item.turno || '').toLowerCase() || 'sin turno').push(item); });
    const orden = (turno) => { const index = turnos.indexOf(turno); return index === -1 ? turnos.length : index; };
    return [...byArea.entries()]
      .map(([area, map]) => ({ area, total: [...map.values()].reduce((acc, list) => acc + list.length, 0), turnos: [...map.entries()].map(([turno, list]) => ({ turno, employees: list })).sort((a, b) => orden(a.turno) - orden(b.turno)) }))
      .filter((group) => group.total > 0)
      .sort((a, b) => (a.area === 'Sin área') - (b.area === 'Sin área') || a.area.localeCompare(b.area, 'es'));
  }, [employees, filtered]);
  return <Layout><div className="empleados-content"><div className="empleados-heading"><div><h1>Historial de empleados</h1><p>Consultá la evolución de las mediciones de todos los operarios.</p></div><div className="empleados-live"><span></span>Datos del período seleccionado</div></div><div className="empleados-toolbar"><div className="empleados-field"><label>Buscar operario</label><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Nombre o legajo..." /></div><div className="empleados-field empleados-field--small"><label>Área</label><select value={filters.area} onChange={(event) => setFilters({ ...filters, area: event.target.value })}><option value="">Todas</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></div><div className="empleados-field empleados-field--small"><label>Turno</label><select value={filters.turno} onChange={(event) => setFilters({ ...filters, turno: event.target.value })}><option value="">Todos</option>{turnos.map((turno) => <option key={turno} value={turno}>{turno}</option>)}</select></div><div className="empleados-field empleados-field--small"><label>Desde</label><input type="date" value={filters.desde} onChange={(event) => setFilters({ ...filters, desde: event.target.value })} /></div><div className="empleados-field empleados-field--small"><label>Hasta</label><input type="date" value={filters.hasta} onChange={(event) => setFilters({ ...filters, hasta: event.target.value })} /></div><button className="btn-export" onClick={onSearch}>Actualizar</button></div>{loading && <div className="empleado-empty">Cargando empleados y mediciones...</div>}{error && <div className="empleado-error">{error}</div>}{!loading && !error && <><p className="empleados-count">{filtered.length} de {employees.length} empleados activos</p>{filtered.length > 0 && <div className="grupos-area-turno empleados-grupos">{groups.map((group) => <section className="area-turno-seccion" key={group.area}><h3 className="area-turno-seccion__titulo">{group.area} <small>{group.total} operario{group.total !== 1 ? 's' : ''}</small></h3><div className="area-turno-seccion__turnos">{group.turnos.map((turno) => <article className="grupo-area-turno" key={turno.turno}><header className="grupo-area-turno__header"><h4>{turnoLabel(turno.turno)}</h4><span>{turno.employees.length} operario{turno.employees.length !== 1 ? 's' : ''}</span></header><div className="grupo-area-turno__operarios empleados-grupo__cards">{turno.employees.length ? turno.employees.map((employee) => <EmployeeCard key={employee.id} employee={employee} onClick={() => onSelect(employee)} />) : <span className="grupo-area-turno__vacio">Sin operarios para los filtros</span>}</div></article>)}</div></section>)}</div>}{filtered.length === 0 && <div className="empleado-empty">No hay empleados que coincidan con los filtros.</div>}</>}</div></Layout>;
}

// Colores de las marcas de alerta sobre el gráfico (mismos tonos que los umbrales).
const ALERT_MARKS = {
  FATIGA: { label: 'Fatiga', cls: 'fatiga' },
  SOBREESFUERZO: { label: 'Sobreesfuerzo', cls: 'sobreesfuerzo' },
  INACTIVIDAD_PROLONGADA: { label: 'Inactividad prolongada', cls: 'inactividad' },
};
const alertMark = (tipo) => ALERT_MARKS[String(tipo || '').toUpperCase()] || { label: tipo || 'Alerta', cls: 'otra' };
const CHART_BOX = { width: 760, height: 280, left: 44, right: 18, top: 22, bottom: 40 };
const PLOT_W = CHART_BOX.width - CHART_BOX.left - CHART_BOX.right;
const ZOOM_MIN_MS = 10 * 60_000; // ventana mínima: 10 minutos (los puntos son de 1 minuto)
const MAX_DRAWN_POINTS = 700; // por encima se promedia por columna para no dibujar miles de nodos
const GAP_MS = 5 * 60_000; // más de 5 min sin lecturas corta la línea

function formatTick(t, span) {
  const date = new Date(t);
  if (span > 3 * 24 * 3600_000) return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  if (span > 18 * 3600_000) return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
function clampWindow(start, span, t0, t1) {
  const total = t1 - t0;
  const s = Math.min(total, Math.max(Math.min(ZOOM_MIN_MS, total), span));
  const v0 = Math.min(t1 - s, Math.max(t0, start));
  return { v0, v1: v0 + s };
}

function Chart({ points, alerts = [], fatigue = 130, overexertion = 160 }) {
  const series = useMemo(() => points.map((point) => ({ ...point, t: new Date(point.ts).getTime() })).filter((point) => !Number.isNaN(point.t)).sort((a, b) => a.t - b.t), [points]);
  const marks = useMemo(() => alerts.map((alert) => ({ id: alert.id, t: new Date(alert.fecha_hora).getTime(), estado: alert.estado, ...alertMark(alert.tipo_alerta) })).filter((mark) => !Number.isNaN(mark.t)), [alerts]);
  const times = [...series.map((point) => point.t), ...marks.map((mark) => mark.t)];
  const t0 = times.length ? Math.min(...times) : 0;
  const t1 = times.length ? Math.max(Math.max(...times), t0 + 60_000) : 0;

  const [view, setView] = useState({ v0: t0, v1: t1 });
  const viewRef = useRef(view); viewRef.current = view;
  const containerRef = useRef(null); const svgRef = useRef(null); const dragRef = useRef(null);
  useEffect(() => { setView({ v0: t0, v1: t1 }); }, [t0, t1]);

  const zoom = (factor, center) => {
    const { v0, v1 } = viewRef.current; const span = v1 - v0; const c = center ?? (v0 + v1) / 2;
    const next = span * factor; setView(clampWindow(c - ((c - v0) / span) * next, next, t0, t1));
  };
  const reset = () => setView({ v0: t0, v1: t1 });
  const timeAt = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect(); const { v0, v1 } = viewRef.current;
    const ratio = Math.min(1, Math.max(0, (((clientX - rect.left) / rect.width) * CHART_BOX.width - CHART_BOX.left) / PLOT_W));
    return v0 + ratio * (v1 - v0);
  };

  // La rueda se registra a mano: en React onWheel es pasivo y no deja frenar el scroll de la página.
  useEffect(() => {
    const element = containerRef.current; if (!element) return undefined;
    const onWheel = (event) => { if (!svgRef.current || !svgRef.current.contains(event.target)) return; event.preventDefault(); zoom(event.deltaY < 0 ? 0.8 : 1.25, timeAt(event.clientX)); };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  });

  // Arrastre: se captura el puntero recién al moverse, para que el doble clic (restablecer) siga llegando al gráfico.
  const onPointerDown = (event) => { if (event.button !== 0) return; dragRef.current = { x: event.clientX, width: svgRef.current.getBoundingClientRect().width, ...viewRef.current, active: false }; };
  const onPointerMove = (event) => {
    const drag = dragRef.current; if (!drag) return;
    if (!drag.active) { if (Math.abs(event.clientX - drag.x) < 3) return; drag.active = true; containerRef.current.setPointerCapture(event.pointerId); containerRef.current.classList.add('is-dragging'); }
    const dx = ((event.clientX - drag.x) / drag.width) * CHART_BOX.width; const span = drag.v1 - drag.v0;
    setView(clampWindow(drag.v0 - (dx / PLOT_W) * span, span, t0, t1));
  };
  const endDrag = () => { dragRef.current = null; containerRef.current?.classList.remove('is-dragging'); };

  if (!series.length && !marks.length) return <div className="empleado-empty">No hay mediciones para graficar en este período.</div>;

  const { v0, v1 } = view; const span = Math.max(v1 - v0, 1);
  const { width, height, left, right, top, bottom } = CHART_BOX;
  const x = (t) => left + ((t - v0) / span) * PLOT_W;

  // Puntos visibles más un vecino a cada lado para que la línea llegue al borde.
  let first = series.findIndex((point) => point.t >= v0); if (first === -1) first = series.length; first = Math.max(0, first - 1);
  let last = -1; for (let i = series.length - 1; i >= 0; i -= 1) { if (series[i].t <= v1) { last = Math.min(series.length - 1, i + 1); break; } }
  const segment = last >= first ? series.slice(first, last + 1) : [];
  const visible = segment.filter((point) => point.t >= v0 && point.t <= v1);

  // Con muchos puntos (rangos de varios días) se promedia por columna de pantalla.
  let drawn = segment; let gap = GAP_MS;
  if (segment.length > MAX_DRAWN_POINTS) {
    const colMs = span / MAX_DRAWN_POINTS; const cols = new Map();
    segment.forEach((point) => { const key = Math.floor((point.t - v0) / colMs); const col = cols.get(key) || { t: 0, sum: 0, lecturas: 0, n: 0, fcMin: Infinity, fcMax: -Infinity }; col.t += point.t; col.sum += point.fcPromedio; col.n += 1; col.lecturas += point.lecturas; col.fcMin = Math.min(col.fcMin, point.fcMin ?? point.fcPromedio); col.fcMax = Math.max(col.fcMax, point.fcMax ?? point.fcPromedio); cols.set(key, col); });
    drawn = [...cols.values()].map((col) => ({ t: col.t / col.n, fcPromedio: Math.round(col.sum / col.n), lecturas: col.lecturas, fcMin: col.fcMin, fcMax: col.fcMax })).sort((a, b) => a.t - b.t);
    gap = Math.max(GAP_MS, colMs * 2.5);
  }

  const values = (visible.length ? visible : segment).map((point) => point.fcPromedio);
  const min = Math.max(30, Math.floor(Math.min(...values, fatigue) / 10) * 10 - 10);
  const max = Math.min(220, Math.ceil(Math.max(...values, overexertion) / 10) * 10 + 10);
  const y = (value) => height - bottom - ((value - min) / Math.max(max - min, 1)) * (height - top - bottom);
  const line = drawn.map((point, index) => `${index === 0 || point.t - drawn[index - 1].t > gap ? 'M' : 'L'} ${x(point.t).toFixed(1)} ${y(point.fcPromedio).toFixed(1)}`).join(' ');
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(min + ((max - min) * index) / 4));
  const xTicks = Array.from({ length: 6 }, (_, index) => v0 + (span * index) / 5);
  const drawnVisible = drawn.filter((point) => point.t >= v0 && point.t <= v1);
  const radius = drawnVisible.length <= 150 ? 4 : 2.5;
  const visibleMarks = marks.filter((mark) => mark.t >= v0 && mark.t <= v1);
  const full = v0 <= t0 && v1 >= t1; const atMin = span <= Math.min(ZOOM_MIN_MS, t1 - t0) + 1;
  const tipos = [...new Map(marks.map((mark) => [mark.cls, mark])).values()];

  return <div className="empleado-chart-zoom" ref={containerRef} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
    <div className="empleado-chart-toolbar">
      <span className="empleado-chart-toolbar__range">{full ? 'Período completo' : `${formatDate(v0)} – ${formatDate(v1)}`}</span>
      <span className="empleado-chart-toolbar__hint">Rueda del mouse para hacer zoom · arrastrá para moverte · doble clic para restablecer</span>
      <div className="empleado-chart-toolbar__zoom" role="group" aria-label="Zoom del gráfico"><button type="button" onClick={() => zoom(2)} disabled={full} aria-label="Alejar">−</button><button type="button" onClick={() => zoom(0.5)} disabled={atMin} aria-label="Acercar">+</button><button type="button" onClick={reset} disabled={full}>Restablecer</button></div>
    </div>
    <svg ref={svgRef} className="empleado-chart empleado-chart--zoomable" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución de frecuencia cardíaca" onPointerDown={onPointerDown} onDoubleClick={reset}>
      <defs><clipPath id="empleadoChartClip"><rect x={left} y="0" width={PLOT_W} height={height} /></clipPath></defs>
      {ticks.map((tick) => <g key={tick}><line className="empleado-chart__grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text x="4" y={y(tick) + 4}>{tick}</text></g>)}
      <line className="empleado-chart__threshold" x1={left} x2={width - right} y1={y(fatigue)} y2={y(fatigue)} /><line className="empleado-chart__threshold empleado-chart__threshold--critical" x1={left} x2={width - right} y1={y(overexertion)} y2={y(overexertion)} />
      <g clipPath="url(#empleadoChartClip)">
        {visibleMarks.map((mark) => <g key={`alert-${mark.id}`} className={`empleado-chart__alert empleado-chart__alert--${mark.cls}`}><line x1={x(mark.t)} x2={x(mark.t)} y1={top} y2={height - bottom} /><line className="empleado-chart__alert-hit" x1={x(mark.t)} x2={x(mark.t)} y1={top} y2={height - bottom}><title>{`${mark.label} · ${formatDate(mark.t)}${mark.estado ? ` · ${mark.estado}` : ''}`}</title></line>{visibleMarks.length <= 4 && <text x={x(mark.t) + 4} y={top - 8 + 9}>{mark.label}</text>}</g>)}
        <path className="empleado-chart__line" d={line} />
        {drawnVisible.length <= 400 && drawnVisible.map((point) => <circle className="empleado-chart__point" key={point.t} cx={x(point.t)} cy={y(point.fcPromedio)} r={radius} fill="var(--teal-400)"><title>{`${point.fcPromedio} BPM · ${formatDate(point.t)} · ${point.lecturas} lectura(s)`}</title></circle>)}
      </g>
      {xTicks.map((t, index) => <text className="empleado-chart__date" key={`tick-${index}`} x={x(t)} y={height - 13} textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}>{formatTick(t, span)}</text>)}
      <text className="empleado-chart__label empleado-chart__label--fatigue" x={left + 5} y={y(fatigue) - 5}>Fatiga {fatigue}</text><text className="empleado-chart__label empleado-chart__label--critical" x={left + 5} y={y(overexertion) - 5}>Sobreesfuerzo {overexertion}</text>
    </svg>
    {marks.length > 0 && <div className="empleado-chart-legend">{tipos.map((mark) => <span key={mark.cls} className={`empleado-chart-legend__item empleado-chart-legend__item--${mark.cls}`}><i></i>{mark.label}</span>)}<span className="empleado-chart-legend__count">{visibleMarks.length} de {marks.length} alertas en pantalla</span></div>}
  </div>;
}

function DetailView({ employee, filters, onBack }) {
  const [detail, setDetail] = useState({ loading: true, series: [], rows: [], alerts: [], error: '' });
  useEffect(() => { let cancelled = false; const name = encodeURIComponent(fullName(employee)); const id = encodeURIComponent(employee.id); Promise.all([apiFetch(`/mediciones?desde=${filters.desde}&hasta=${filters.hasta}&id_trabajador=${id}&limit=200`), apiFetch(`/mediciones?desde=${filters.desde}&hasta=${filters.hasta}&id_trabajador=${id}&bucket=1m`), apiFetch(`/alertas/historico?desde=${filters.desde}&empleado=${name}`)]).then(([rows, series, alerts]) => { if (cancelled) return; /* El filtro por nombre del backend es parcial (ILIKE): se acota por id y al "Hasta" del período. */ const hastaFin = new Date(`${filters.hasta}T23:59:59.999`).getTime(); const ownAlerts = (alerts.data || []).filter((alert) => String(alert.id_trabajador) === String(employee.id) && new Date(alert.fecha_hora).getTime() <= hastaFin); setDetail({ loading: false, rows: rows.data || [], series: series.data || [], alerts: ownAlerts, error: '' }); }).catch((error) => { if (!cancelled) setDetail({ loading: false, series: [], rows: [], alerts: [], error: error.message }); }); return () => { cancelled = true; }; }, [employee, filters.desde, filters.hasta]);
  return <Layout selected={employee} onBack={onBack}><div className="empleado-detail"><div className="empleado-detail__heading"><div className="empleado-avatar empleado-detail__avatar">{initials(fullName(employee))}</div><div><h1>{fullName(employee)}</h1><p>{employee.legajo || 'Sin legajo'} · {employee.area || 'Sin área'}{employee.turno ? ` · Turno ${employee.turno}` : ''}</p></div></div><div className="empleado-detail__range"><label>Desde<input type="date" value={filters.desde} readOnly /></label><label>Hasta<input type="date" value={filters.hasta} readOnly /></label><span className="empleado-card__tag">Período seleccionado</span></div><div className="empleado-stats"><div className="empleado-stat"><span>Promedio FC</span><strong>{employee.fcPromedio ?? '--'} <small>BPM</small></strong></div><div className="empleado-stat"><span>Mínimo</span><strong>{employee.fcMin ?? '--'} <small>BPM</small></strong></div><div className="empleado-stat"><span>Máximo</span><strong>{employee.fcMax ?? '--'} <small>BPM</small></strong></div><div className="empleado-stat"><span>Lecturas</span><strong>{employee.lecturas || 0}</strong></div><div className="empleado-stat"><span>Alertas</span><strong>{employee.alertasTotal || 0}</strong></div></div>{detail.loading && <div className="empleado-empty">Cargando historial...</div>}{detail.error && <div className="empleado-error">{detail.error}</div>}{!detail.loading && !detail.error && <div className="empleado-detail-grid"><div className="empleado-detail-card"><div className="empleado-detail-card__header"><h2>Evolución de frecuencia cardíaca</h2><span>Umbrales y alertas marcados</span></div><Chart points={detail.series} alerts={detail.alerts} /></div><div className="empleado-detail-card"><div className="empleado-detail-card__header"><h2>Historial de alertas</h2><span>{detail.alerts.length} registradas</span></div><div className="empleado-alerts">{detail.alerts.length ? detail.alerts.slice(0, 8).map((alert) => <div className="empleado-alert" key={alert.id}><span className="empleado-alert__dot"></span><div><strong>{alert.tipo_alerta || 'Alerta'}</strong><span>{formatDate(alert.fecha_hora)} · {alert.estado || 'Registrada'}</span></div></div>) : <div className="empleado-empty">No hay alertas en el período.</div>}</div></div><div className="empleado-detail-card" style={{ gridColumn: '1 / -1' }}><div className="empleado-detail-card__header"><h2>Lecturas registradas</h2><span>Últimas {detail.rows.length}</span></div><div className="empleado-table-scroll"><table className="empleado-readings"><thead><tr><th>Fecha y hora</th><th>Frecuencia cardíaca</th><th>Actividad</th></tr></thead><tbody>{detail.rows.slice(0, 100).map((row) => <tr key={row.id}><td>{formatDate(row.fecha_hora)}</td><td><strong>{row.frecuencia_cardiaca ?? '--'} BPM</strong></td><td>{row.actividad ?? '--'}</td></tr>)}</tbody></table></div></div></div>}</div></Layout>;
}

function App() {
  const [employees, setEmployees] = useState([]); const [selected, setSelected] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [filters, setFilters] = useState({ search: '', area: '', turno: '', desde: defaultDesde, hasta: defaultHasta });
  const load = async () => { setLoading(true); setError(''); try { const [workersPayload, summaryPayload] = await Promise.all([apiFetch('/trabajadores'), apiFetch(`/mediciones/resumen?desde=${filters.desde}&hasta=${filters.hasta}`)]); const summaries = new Map((summaryPayload.data || []).map((item) => [String(item.idTrabajador), item])); const merged = (workersPayload.data || []).map((worker) => { const summary = summaries.get(String(worker.id)) || {}; const alertasPorTipo = summary.alertasPorTipo || {}; return { ...worker, ...summary, id: worker.id, nombre: worker.nombre, apellido: worker.apellido, area: worker.area, turno: worker.turno, alertasTotal: Object.values(alertasPorTipo).reduce((total, value) => total + Number(value || 0), 0) }; }); setEmployees(merged); } catch (loadError) { setError(loadError.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return selected ? <DetailView employee={selected} filters={filters} onBack={() => setSelected(null)} /> : <ListView employees={employees} loading={loading} error={error} filters={filters} setFilters={setFilters} onSearch={load} onSelect={setSelected} />;
}

createRoot(document.getElementById('root')).render(<><SessionUserUI /><App /></>);
