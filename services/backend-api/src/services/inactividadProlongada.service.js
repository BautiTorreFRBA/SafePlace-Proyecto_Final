const historialEstadoDispositivoRepository = require('../repositories/historialEstadoDispositivo.repository');
const horarioOperarioRepository = require('../repositories/horarioOperario.repository');
const umbralRiesgoRepository = require('../repositories/umbralRiesgo.repository');
const trabajoRepository = require('../repositories/trabajo.repository');
const operarioSeudonimoRepository = require('../repositories/operarioSeudonimo.repository');
const tipoAlertaRepository = require('../repositories/tipoAlerta.repository');
const alertaRepository = require('../repositories/alerta.repository');
const inactividadCandidatoRepository = require('../repositories/inactividadCandidato.repository');
const alertasService = require('./alertas.service');

/**
 * CP-E2E-04 / H0012 (reencuadrada) — "inactividad prolongada".
 *
 * Condición de negocio: el wearable de un operario estuvo DESCONECTADO más
 * que `umbral_riesgo.minutos_desconexion_tolerada` MIENTRAS el operario
 * estaba dentro de su horario laboral (horario_operario). Sacarse el
 * wearable fuera de ese horario no genera alerta.
 *
 * Se corre periódicamente desde server.js (no por evento de medición). El
 * evento DESCONECTADO lo genera el hub directamente, o la inferencia de
 * H0006 (estadoDispositivo.service) tras DESCONEXION_MINUTOS sin datos.
 *
 * Antiduplicado (H0013): una sola alerta INACTIVIDAD_PROLONGADA Activa por
 * operario a la vez. Se cierra cuando el wearable vuelve a CONECTADO
 * (dispositivos.controller / mediciones.service).
 */

const TIPO = 'INACTIVIDAD_PROLONGADA';

const _bloqueado = { valor: false };

// Tolerancia efectiva para un candidato: la del trabajo asignado a su
// ventana de horario vigente (si está activo), o la global si no.
const resolverTolerancia = async (idOperario, umbralGlobal) => {
  const ventana = await horarioOperarioRepository.obtenerVentanaVigente(idOperario);
  if (ventana?.id_trabajo) {
    const trabajo = await trabajoRepository.obtenerPorId(ventana.id_trabajo);
    if (trabajo?.activo) return { ventana, tolerancia: Number(trabajo.minutos_desconexion_tolerada) };
  }
  return { ventana, tolerancia: Number(umbralGlobal.minutos_desconexion_tolerada) };
};

const chequear = async () => {
  if (_bloqueado.valor) return 0;
  _bloqueado.valor = true;
  try {
    const umbralGlobal = await umbralRiesgoRepository.obtenerVigente();
    const toleranciaGlobal = umbralGlobal && Number(umbralGlobal.minutos_desconexion_tolerada);
    if (!toleranciaGlobal || Number.isNaN(toleranciaGlobal)) return 0;

    // Todo dispositivo desconectado con asignación vigente y una conexión
    // real previa — sin filtrar por tolerancia acá: el "hace cuánto" real es
    // desde que ESTE chequeo lo detectó (inactividad_candidato), no la marca
    // del evento histórico, que puede ser de antes de que nadie lo mirara.
    const candidatos = await historialEstadoDispositivoRepository.listarDesconectadosParaAlerta();

    let generadas = 0;
    for (const c of candidatos) {
      const { ventana, tolerancia } = await resolverTolerancia(c.id_operario, umbralGlobal);
      if (!ventana) continue;

      // Primera vez que se ve este dispositivo desconectado => arranca el
      // reloj ahora. Si ya había un candidato de un chequeo anterior, se
      // reusa su primera_deteccion sin tocarla.
      const primeraDeteccion = await inactividadCandidatoRepository.marcarPrimeraDeteccion(c.id_dispositivo);
      const minutosObservadoDesconectado = (Date.now() - new Date(primeraDeteccion).getTime()) / 60000;
      if (minutosObservadoDesconectado < tolerancia) continue;

      const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(c.id_operario);
      const alerta = await alertasService.generar({
        nombreTipo: TIPO,
        idSeudonimo: seudonimo.id,
        idMedicion: null,
        detalle: `Wearable ${c.id_dispositivo} del operario ${c.id_operario} desconectado desde `
          + `${new Date(c.desconectado_desde).toISOString()} (detectado desde `
          + `${new Date(primeraDeteccion).toISOString()}) durante horario laboral `
          + `(tolerancia ${tolerancia} min).`,
      });
      if (alerta) generadas += 1;
    }
    return generadas;
  } finally {
    _bloqueado.valor = false;
  }
};

// Cierre de la alerta cuando el wearable se reconecta. Llamado desde el
// registro de estado CONECTADO. Limpia también el candidato de inactividad
// del dispositivo: el próximo corte tiene que arrancar el reloj de cero, no
// seguir contando desde la desconexión anterior.
const resolverPorReconexion = async (idOperario, idDispositivo = null) => {
  if (idDispositivo != null) {
    await inactividadCandidatoRepository.limpiar(idDispositivo);
  }

  const seudonimo = await operarioSeudonimoRepository.obtenerPorOperario(idOperario);
  if (!seudonimo) return [];

  const tipo = await tipoAlertaRepository.obtenerPorNombre(TIPO);
  if (!tipo) return [];

  return alertaRepository.cerrarActivasPorSeudonimoYTipo(seudonimo.id, tipo.id);
};

module.exports = {
  chequear,
  resolverPorReconexion,
  TIPO,
};
