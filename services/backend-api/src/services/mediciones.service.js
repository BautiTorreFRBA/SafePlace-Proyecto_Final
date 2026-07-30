const medicionRepository = require('../repositories/medicion.repository');
const validacionDatosService = require('./validacion/validacion-datos.service');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
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
 *
 * H0009 pide además que la propia persistencia exitosa quede auditada, y que
 * un error de almacenamiento (no un descarte de validación) también deje
 * incidente registrado — best-effort, no corta la respuesta al gateway.
 */
const auditarPersistencia = ({ medicion, ipOrigen }) => logAuditoriaRepository
  .registrar({
    idUsuario: null, // origen: gateway autenticado por token de dispositivo
    tablaAfectada: 'medicion',
    idRegistro: medicion.id,
    operacion: 'CREATE',
    ipOrigen: ipOrigen || null,
    detalle: `Medición del trabajador ${medicion.id_trabajador} (wearable ${medicion.id_dispositivo}).`,
  })
  .catch((err) => {
    console.error('[mediciones.service] No se pudo auditar la persistencia:', err.message);
  });

const auditarErrorAlmacenamiento = ({ paquete, error, ipOrigen }) => logAuditoriaRepository
  .registrar({
    idUsuario: null,
    tablaAfectada: 'medicion',
    idRegistro: null,
    operacion: 'ERROR_ALMACENAMIENTO',
    ipOrigen: ipOrigen || null,
    detalle: `Error al almacenar medición del wearable ${paquete?.idDispositivo ?? 'desconocido'}: ${error.message}`,
  })
  .catch((err) => {
    console.error('[mediciones.service] No se pudo auditar el incidente de almacenamiento:', err.message);
  });

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

    await auditarPersistencia({ medicion: creada, ipOrigen: contexto.ipOrigen });
    return creada;
  } catch (error) {
    if (error instanceof ErrorValidacion) {
      if (error.auditar) {
        await validacionDatosService.auditarDescarte(paquete, error, contexto);
      }
    } else {
      // Error no tipado (ej. falla de conexión a la base): la medición ya
      // pasó la validación, así que esto es un incidente de almacenamiento
      // (H0009), no un descarte de datos inválidos.
      await auditarErrorAlmacenamiento({ paquete, error, ipOrigen: contexto.ipOrigen });
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
