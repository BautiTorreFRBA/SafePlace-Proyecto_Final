const historialEstadoDispositivoRepository = require('../repositories/historialEstadoDispositivo.repository');
const horarioOperarioRepository = require('../repositories/horarioOperario.repository');
const umbralRiesgoRepository = require('../repositories/umbralRiesgo.repository');
const operarioSeudonimoRepository = require('../repositories/operarioSeudonimo.repository');
const tipoAlertaRepository = require('../repositories/tipoAlerta.repository');
const alertaRepository = require('../repositories/alerta.repository');
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

const chequear = async () => {
  if (_bloqueado.valor) return 0;
  _bloqueado.valor = true;
  try {
    const umbral = await umbralRiesgoRepository.obtenerVigente();
    const tolerancia = umbral && Number(umbral.minutos_desconexion_tolerada);
    if (!tolerancia || Number.isNaN(tolerancia)) return 0;

    const candidatos = await historialEstadoDispositivoRepository
      .listarDesconectadosParaAlerta(tolerancia);

    let generadas = 0;
    for (const c of candidatos) {
      const enHorario = await horarioOperarioRepository.estaDentroDeHorario(c.id_operario);
      if (!enHorario) continue;

      const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(c.id_operario);
      const alerta = await alertasService.generar({
        nombreTipo: TIPO,
        idSeudonimo: seudonimo.id,
        idMedicion: null,
        detalle: `Wearable ${c.id_dispositivo} del operario ${c.id_operario} desconectado desde `
          + `${new Date(c.desconectado_desde).toISOString()} durante horario laboral `
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
// registro de estado CONECTADO y desde la ingesta de una nueva medición.
const resolverPorReconexion = async (idOperario) => {
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
