const registroConsentimientoRepository = require('../../repositories/registroConsentimiento.repository');

/**
 * Flag binario de consentimiento en caché (RNF-09): la validación de cada
 * paquete no debe pagar una consulta pesada por request. Caché en memoria con
 * TTL por trabajador; es local a la instancia (sin estado compartido, RNF-03)
 * y reemplazable por una caché distribuida (p. ej. Redis) sin tocar a sus
 * consumidores, que sólo usan tieneConsentimientoActivo().
 *
 * El TTL acota la ventana en que una revocación todavía no se refleja; cuando
 * se implemente el alta/revocación de H0019, ese flujo debe llamar a
 * invalidar(idTrabajador) para que el bloqueo sea inmediato.
 */
const TTL_MS = Number(process.env.CONSENTIMIENTO_CACHE_TTL_MS) || 30000;

const cache = new Map(); // idTrabajador -> { activo, vence }

const tieneConsentimientoActivo = async (idTrabajador) => {
  const entrada = cache.get(idTrabajador);
  if (entrada && entrada.vence > Date.now()) {
    return entrada.activo;
  }

  const vigente = await registroConsentimientoRepository.obtenerVigente(idTrabajador);
  // Sin registro = sin consentimiento (Anexo de reglas de negocio: FALSE o inexistente).
  const activo = vigente ? vigente.estado === true : false;

  cache.set(idTrabajador, { activo, vence: Date.now() + TTL_MS });
  return activo;
};

const invalidar = (idTrabajador) => {
  cache.delete(idTrabajador);
};

const limpiar = () => {
  cache.clear();
};

module.exports = {
  tieneConsentimientoActivo,
  invalidar,
  limpiar,
};
