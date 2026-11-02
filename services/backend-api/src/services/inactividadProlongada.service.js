const historialEstadoDispositivoRepository = require('../repositories/historialEstadoDispositivo.repository');
const horarioOperarioRepository = require('../repositories/horarioOperario.repository');
const umbralRiesgoRepository = require('../repositories/umbralRiesgo.repository');
const trabajoRepository = require('../repositories/trabajo.repository');
const operarioSeudonimoRepository = require('../repositories/operarioSeudonimo.repository');
const medicionRepository = require('../repositories/medicion.repository');
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
 * operario a la vez, y queda Activa HASTA QUE UNA PERSONA LA ATIENDA. La
 * reconexión del wearable NO la cierra: la alerta documenta que el operario
 * estuvo sin wearable durante su turno, y eso ya ocurrió — que el reloj
 * vuelva no lo desmiente. La reconexión sólo re-arma el detector para el
 * próximo corte (dispositivos.controller / mediciones.service).
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
    // 0 es una tolerancia válida (alerta en el primer chequeo que ve la
    // desconexión) — no puede tratarse como "ausente" solo por ser falsy.
    const toleranciaGlobal = umbralGlobal ? Number(umbralGlobal.minutos_desconexion_tolerada) : null;
    if (toleranciaGlobal == null || Number.isNaN(toleranciaGlobal)) return 0;

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
      // reusa su fila sin tocarla.
      const candidato = await inactividadCandidatoRepository.marcarPrimeraDeteccion(c.id_dispositivo);
      if (!candidato || candidato.alertado) continue; // este corte ya avisó una vez

      const minutosObservadoDesconectado = (Date.now() - new Date(candidato.primera_deteccion).getTime()) / 60000;
      if (minutosObservadoDesconectado < tolerancia) continue;

      const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(c.id_operario);
      const alerta = await alertasService.generar({
        nombreTipo: TIPO,
        idSeudonimo: seudonimo.id,
        idMedicion: null,
        detalle: `Wearable ${c.id_dispositivo} del operario ${c.id_operario} desconectado desde `
          + `${new Date(c.desconectado_desde).toISOString()} (detectado desde `
          + `${new Date(candidato.primera_deteccion).toISOString()}) durante horario laboral `
          + `(tolerancia ${tolerancia} min).`,
      });
      if (alerta) {
        generadas += 1;
        await inactividadCandidatoRepository.marcarAlertado(c.id_dispositivo);
      }
    }
    return generadas;
  } finally {
    _bloqueado.valor = false;
  }
};

// Borra el candidato, que es lo que habilita un aviso nuevo para el próximo
// corte. NO cierra la alerta: una INACTIVIDAD_PROLONGADA Activa queda Activa
// hasta que una persona la atienda. Mientras siga Activa, el antiduplicado de
// alertas.service.generar impide que se cree otra para el mismo operario, que
// es exactamente "una sola hasta que se atienda".
const rearmarDetector = async (idDispositivo = null) => {
  if (idDispositivo == null) return;
  await inactividadCandidatoRepository.limpiar(idDispositivo);
};

// Reconexión del wearable (registro de estado CONECTADO). Limpia el candidato
// de inactividad: el próximo corte tiene que arrancar el reloj de cero, no
// seguir contando desde la desconexión anterior.
//
// Deliberadamente NO cierra la alerta en curso. Antes sí lo hacía, y el
// resultado era que un corte durante el turno desaparecía del tablero en
// cuanto el operario se volvía a poner el wearable: nadie llegaba a verlo.
// Cerrarla es una decisión humana (H0013).
const resolverPorReconexion = async (idOperario, idDispositivo = null) => rearmarDetector(idDispositivo);

// Corrección de estado por evidencia directa. El reporte de conexión del hub
// puede llegar fuera de orden o no llegar nunca; una medición persistida es
// prueba objetiva de que el wearable está transmitiendo. Enganchado
// best-effort desde mediciones.service.registrarMedicion, nunca debe romper
// el 201 al gateway.
//
// Si el último evento de estado dice DESCONECTADO y sin embargo siguen
// entrando mediciones reales, el estado está mintiendo: se corrige
// registrando CONECTADO y se re-arma el detector. Dejar el estado en
// DESCONECTADO con el candidato ya alertado deja la inactividad MUERTA para
// ese dispositivo: el próximo corte de verdad no avisa nunca, porque
// listarDesconectadosParaAlerta lo sigue viendo desconectado y
// marcarPrimeraDeteccion le devuelve el candidato viejo con alertado = true.
//
// Pero UNA sola medición posterior al corte no desmiente nada: el gateway
// suele tener una lectura en el buffer y la postea justo después de haber
// reportado DESCONECTADO. Tomarla como prueba de conexión re-armaba el
// detector con el wearable realmente apagado (caso real: corte 18:30:42,
// rezagada 18:30:43, y después nada más). Por eso se exigen
// MEDICIONES_PARA_CONFIRMAR_CONEXION lecturas capturadas DESPUÉS del evento
// de desconexión: dos seguidas sólo pueden venir de un enlace vivo.
//
// Nada de esto toca la alerta: siga o no el corte, una
// INACTIVIDAD_PROLONGADA Activa queda Activa hasta que alguien la atienda.
const MEDICIONES_PARA_CONFIRMAR_CONEXION = 2;

const resolverPorMedicionReal = async (idSeudonimo, idDispositivo = null) => {
  if (idDispositivo == null) return;

  const ultimo = await historialEstadoDispositivoRepository.obtenerUltimoEstado(idDispositivo);
  if (ultimo?.estado !== 'DESCONECTADO') return;

  const posteriores = await medicionRepository.contarDesde(idDispositivo, ultimo.fecha_hora);
  if (posteriores < MEDICIONES_PARA_CONFIRMAR_CONEXION) return;

  await historialEstadoDispositivoRepository.registrarEstado(idDispositivo, 'CONECTADO');
  await rearmarDetector(idDispositivo);
};

module.exports = {
  chequear,
  resolverPorReconexion,
  resolverPorMedicionReal,
  TIPO,
};
