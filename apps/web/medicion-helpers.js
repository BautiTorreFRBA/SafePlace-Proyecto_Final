/**
 * Helpers compartidos de las vistas de vitales (Monitoreo y Mediciones).
 * Antes estaban duplicados en cada archivo *.js (3.5 del rediseño).
 *
 * Se expone como window.MedHelpers porque las vistas son HTML estático con
 * <script> sueltos, sin bundler ni módulos ES.
 */
window.MedHelpers = (function () {
  // ── Actividad ───────────────────────────────────────────────────────────
  // El hub estima nivelActividad como float 0.0–1.0 (proxy de FC, ADR-14).
  // Hoy medicion.actividad es varchar: puede llegar como "0.42", como número,
  // o como texto legacy de filas seed ("Baja"/"Moderada"/"Alta").
  function etiquetarActividad(valor) {
    if (valor === null || valor === undefined || valor === '') {
      return { texto: '--', nivel: null, estimado: false };
    }

    const n = typeof valor === 'number'
      ? valor
      : parseFloat(String(valor).replace(',', '.'));

    if (Number.isNaN(n)) {
      // Texto legacy: se muestra capitalizado, sin nivel.
      const t = String(valor).trim();
      return { texto: t.charAt(0).toUpperCase() + t.slice(1), nivel: null, estimado: false };
    }

    let texto = 'Alta';
    let nivel = 'alta';
    if (n < 0.15) { texto = 'Reposo'; nivel = 'reposo'; }
    else if (n < 0.40) { texto = 'Baja'; nivel = 'baja'; }
    else if (n < 0.70) { texto = 'Media'; nivel = 'media'; }
    return { texto, nivel, estimado: true };
  }

  // ── Frescura de la última lectura ───────────────────────────────────────
  function formatearFrescura(segundos) {
    if (segundos === null || segundos === undefined) return '--';
    const s = Math.max(0, Math.round(segundos));
    if (s < 60) return 'hace instantes';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return `hace ${Math.floor(s / 86400)} d`;
  }

  function segundosDesde(fechaHora) {
    const d = new Date(fechaHora);
    if (Number.isNaN(d.getTime())) return null;
    return (Date.now() - d.getTime()) / 1000;
  }

  function esHoy(fechaHora) {
    const d = new Date(fechaHora);
    if (Number.isNaN(d.getTime())) return false;
    const n = new Date();
    return d.getFullYear() === n.getFullYear()
      && d.getMonth() === n.getMonth()
      && d.getDate() === n.getDate();
  }

  // Hora si la lectura es de hoy; fecha + hora si es más vieja.
  function marcaTemporal(fechaHora) {
    const d = new Date(fechaHora);
    if (Number.isNaN(d.getTime())) return '--';
    const hora = d.toLocaleTimeString('es-AR');
    if (esHoy(fechaHora)) return hora;
    return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${hora}`;
  }

  // ── Capacidades del wearable (P4 / S4) ──────────────────────────────────
  // caps: { fc, temperatura, spo2 } | null/undefined (desconocido).
  // Devuelve true (soporta), false (no soporta) o null (desconocido → mostrar).
  function soporta(caps, clave) {
    if (!caps || typeof caps !== 'object') return null;
    return caps[clave] === true;
  }

  return {
    etiquetarActividad,
    formatearFrescura,
    segundosDesde,
    esHoy,
    marcaTemporal,
    soporta,
  };
})();
