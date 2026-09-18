import React, { useEffect, useMemo, useState } from 'react';
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
  return <Layout><div className="empleados-content"><div className="empleados-heading"><div><h1>Historial de empleados</h1><p>Consultá la evolución de las mediciones de todos los operarios.</p></div><div className="empleados-live"><span></span>Datos del período seleccionado</div></div><div className="empleados-toolbar"><div className="empleados-field"><label>Buscar operario</label><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Nombre o legajo..." /></div><div className="empleados-field empleados-field--small"><label>Área</label><select value={filters.area} onChange={(event) => setFilters({ ...filters, area: event.target.value })}><option value="">Todas</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></div><div className="empleados-field empleados-field--small"><label>Turno</label><select value={filters.turno} onChange={(event) => setFilters({ ...filters, turno: event.target.value })}><option value="">Todos</option>{turnos.map((turno) => <option key={turno} value={turno}>{turno}</option>)}</select></div><div className="empleados-field empleados-field--small"><label>Desde</label><input type="date" value={filters.desde} onChange={(event) => setFilters({ ...filters, desde: event.target.value })} /></div><div className="empleados-field empleados-field--small"><label>Hasta</label><input type="date" value={filters.hasta} onChange={(event) => setFilters({ ...filters, hasta: event.target.value })} /></div><button className="btn-export" onClick={onSearch}>Actualizar</button></div>{loading && <div className="empleado-empty">Cargando empleados y mediciones...</div>}{error && <div className="empleado-error">{error}</div>}{!loading && !error && <><p className="empleados-count">{filtered.length} de {employees.length} empleados activos</p><div className="empleados-grid">{filtered.map((employee) => <EmployeeCard key={employee.id} employee={employee} onClick={() => onSelect(employee)} />)}</div>{filtered.length === 0 && <div className="empleado-empty">No hay empleados que coincidan con los filtros.</div>}</>}</div></Layout>;
}

function Chart({ points, fatigue = 130, overexertion = 160 }) {
  if (!points.length) return <div className="empleado-empty">No hay mediciones para graficar en este período.</div>;
  const values = points.map((point) => point.fcPromedio);
  const min = Math.max(30, Math.floor(Math.min(...values, fatigue) / 10) * 10 - 10);
  const max = Math.min(220, Math.ceil(Math.max(...values, overexertion) / 10) * 10 + 10);
  const width = 760; const height = 260; const left = 54; const right = 18; const top = 18; const bottom = 42;
  const x = (index) => left + (index / Math.max(points.length - 1, 1)) * (width - left - right);
  const y = (value) => height - bottom - ((value - min) / Math.max(max - min, 1)) * (height - top - bottom);
  const line = values.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ');
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(min + ((max - min) * index) / 4));
  const dateIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1]));
  return <svg className="empleado-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución de frecuencia cardíaca">
    {ticks.map((tick) => <g key={tick}><line className="empleado-chart__grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text x="4" y={y(tick) + 4}>{tick}</text></g>)}
    <line className="empleado-chart__threshold" x1={left} x2={width - right} y1={y(fatigue)} y2={y(fatigue)} /><line className="empleado-chart__threshold empleado-chart__threshold--critical" x1={left} x2={width - right} y1={y(overexertion)} y2={y(overexertion)} />
    <path className="empleado-chart__line" d={line} />
    {points.map((point, index) => <circle className="empleado-chart__point" key={`${point.ts}-${index}`} cx={x(index)} cy={y(point.fcPromedio)} r="4" fill="var(--teal-400)"><title>{`${point.fcPromedio} BPM · ${formatDate(point.ts)} · ${point.lecturas} lectura(s)`}</title></circle>)}
    {dateIndexes.map((index) => <text className="empleado-chart__date" key={`date-${index}`} x={x(index)} y={height - 13} textAnchor="middle">{formatDateShort(points[index].ts)}</text>)}
    <text className="empleado-chart__label empleado-chart__label--fatigue" x={left + 5} y={y(fatigue) - 5}>Fatiga {fatigue}</text><text className="empleado-chart__label empleado-chart__label--critical" x={left + 5} y={y(overexertion) - 5}>Sobreesfuerzo {overexertion}</text>
  </svg>;
}

function DetailView({ employee, filters, onBack }) {
  const [detail, setDetail] = useState({ loading: true, series: [], rows: [], alerts: [], error: '' });
  useEffect(() => { let cancelled = false; const name = encodeURIComponent(fullName(employee)); Promise.all([apiFetch(`/mediciones?desde=${filters.desde}&hasta=${filters.hasta}&empleado=${name}&limit=200`), apiFetch(`/mediciones?desde=${filters.desde}&hasta=${filters.hasta}&empleado=${name}&bucket=1m`), apiFetch(`/alertas/historico?desde=${filters.desde}&empleado=${name}`)]).then(([rows, series, alerts]) => { if (!cancelled) setDetail({ loading: false, rows: rows.data || [], series: series.data || [], alerts: alerts.data || [], error: '' }); }).catch((error) => { if (!cancelled) setDetail({ loading: false, series: [], rows: [], alerts: [], error: error.message }); }); return () => { cancelled = true; }; }, [employee, filters.desde, filters.hasta]);
  return <Layout selected={employee} onBack={onBack}><div className="empleado-detail"><div className="empleado-detail__heading"><div className="empleado-avatar empleado-detail__avatar">{initials(fullName(employee))}</div><div><h1>{fullName(employee)}</h1><p>{employee.legajo || 'Sin legajo'} · {employee.area || 'Sin área'}{employee.turno ? ` · Turno ${employee.turno}` : ''}</p></div></div><div className="empleado-detail__range"><label>Desde<input type="date" value={filters.desde} readOnly /></label><label>Hasta<input type="date" value={filters.hasta} readOnly /></label><span className="empleado-card__tag">Período seleccionado</span></div><div className="empleado-stats"><div className="empleado-stat"><span>Promedio FC</span><strong>{employee.fcPromedio ?? '--'} <small>BPM</small></strong></div><div className="empleado-stat"><span>Mínimo</span><strong>{employee.fcMin ?? '--'} <small>BPM</small></strong></div><div className="empleado-stat"><span>Máximo</span><strong>{employee.fcMax ?? '--'} <small>BPM</small></strong></div><div className="empleado-stat"><span>Lecturas</span><strong>{employee.lecturas || 0}</strong></div><div className="empleado-stat"><span>Alertas</span><strong>{employee.alertasTotal || 0}</strong></div></div>{detail.loading && <div className="empleado-empty">Cargando historial...</div>}{detail.error && <div className="empleado-error">{detail.error}</div>}{!detail.loading && !detail.error && <div className="empleado-detail-grid"><div className="empleado-detail-card"><div className="empleado-detail-card__header"><h2>Evolución de frecuencia cardíaca</h2><span>Líneas de referencia incluidas</span></div><Chart points={detail.series} /></div><div className="empleado-detail-card"><div className="empleado-detail-card__header"><h2>Historial de alertas</h2><span>{detail.alerts.length} registradas</span></div><div className="empleado-alerts">{detail.alerts.length ? detail.alerts.slice(0, 8).map((alert) => <div className="empleado-alert" key={alert.id}><span className="empleado-alert__dot"></span><div><strong>{alert.tipo_alerta || 'Alerta'}</strong><span>{formatDate(alert.fecha_hora)} · {alert.estado || 'Registrada'}</span></div></div>) : <div className="empleado-empty">No hay alertas en el período.</div>}</div></div><div className="empleado-detail-card" style={{ gridColumn: '1 / -1' }}><div className="empleado-detail-card__header"><h2>Lecturas registradas</h2><span>Últimas {detail.rows.length}</span></div><div className="empleado-table-scroll"><table className="empleado-readings"><thead><tr><th>Fecha y hora</th><th>Frecuencia cardíaca</th><th>Actividad</th></tr></thead><tbody>{detail.rows.slice(0, 100).map((row) => <tr key={row.id}><td>{formatDate(row.fecha_hora)}</td><td><strong>{row.frecuencia_cardiaca ?? '--'} BPM</strong></td><td>{row.actividad ?? '--'}</td></tr>)}</tbody></table></div></div></div>}</div></Layout>;
}

function App() {
  const [employees, setEmployees] = useState([]); const [selected, setSelected] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [filters, setFilters] = useState({ search: '', area: '', turno: '', desde: defaultDesde, hasta: defaultHasta });
  const load = async () => { setLoading(true); setError(''); try { const [workersPayload, summaryPayload] = await Promise.all([apiFetch('/trabajadores'), apiFetch(`/mediciones/resumen?desde=${filters.desde}&hasta=${filters.hasta}`)]); const summaries = new Map((summaryPayload.data || []).map((item) => [String(item.idTrabajador), item])); const merged = (workersPayload.data || []).map((worker) => { const summary = summaries.get(String(worker.id)) || {}; const alertasPorTipo = summary.alertasPorTipo || {}; return { ...worker, ...summary, id: worker.id, nombre: worker.nombre, apellido: worker.apellido, area: worker.area, turno: worker.turno, alertasTotal: Object.values(alertasPorTipo).reduce((total, value) => total + Number(value || 0), 0) }; }); setEmployees(merged); } catch (loadError) { setError(loadError.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return selected ? <DetailView employee={selected} filters={filters} onBack={() => setSelected(null)} /> : <ListView employees={employees} loading={loading} error={error} filters={filters} setFilters={setFilters} onSearch={load} onSelect={setSelected} />;
}

createRoot(document.getElementById('root')).render(<><SessionUserUI /><App /></>);
