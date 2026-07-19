const medicionRepository = require('../repositories/medicion.repository');
const validacionDatosService = require('./validacion/validacion-datos.service');
const { ErrorValidacion, MOTIVOS } = require('./validacion/errores');

/**
 * Ingesta de mediciones (Módulo de Ingesta de Mediciones — único punto de
 * entrada de datos biométricos). Todo paquete del gateway pasa por el
 * Servicio de Validación de Datos (RF-04/H0008) ANTES de persistirse:
 *  - válido  -> se normaliza (idTrabajador resuelto, fechaHora de recepción)
 *               y se entrega al almacenamiento (H0009, medicion.repository);
 *  - inválido-> se descarta, se audita en log_auditoria y se responde con el
 *               motivo (salvo el bloqueo por consentimiento, que se descarta
 *               en memoria sin dejar rastro del biodato — RNF-09/Ley 25.326).
 */
const registrarMedicion = async (paquete, contexto = {}) => {
  try {
    const medicionValidada = await validacionDatosService.validarPaquete(paquete);

    const creada = await medicionRepository.crear(medicionValidada);
    if (!creada) {
      // Carrera entre paquetes idénticos: el índice único lo resolvió en el
      // INSERT (ON CONFLICT DO NOTHING). Se trata como duplicado normal.
      throw new ErrorValidacion(
        MOTIVOS.DUPLICADO,
        'Registro duplicado: ya existe una medición de este wearable con la misma marca de captura.',
        { status: 409 },
      );
    }
    return creada;
  } catch (error) {
    if (error instanceof ErrorValidacion && error.auditar) {
      await validacionDatosService.auditarDescarte(paquete, error, contexto);
    }
    throw error;
  }
};

const listarMediciones = async (filtros) => {
  return await medicionRepository.listar(filtros);
};

const listarMedicionesDeTrabajador = async (idTrabajador, filtros) => {
  return await medicionRepository.listarPorTrabajador(idTrabajador, filtros);
};

module.exports = {
  registrarMedicion,
  listarMediciones,
  listarMedicionesDeTrabajador,
};
