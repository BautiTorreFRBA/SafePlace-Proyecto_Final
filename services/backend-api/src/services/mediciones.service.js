const medicionRepository = require('../repositories/medicion.repository');
const operarioSeudonimoRepository = require('../repositories/operarioSeudonimo.repository');
const validacionDatosService = require('./validacion/validacion-datos.service');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');
const motorReglasService = require('./reglas/motorReglas.service');
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
 *
 * H0020: el almacenamiento nunca asocia el biodato a la identidad civil
 * directa. Antes de persistir se resuelve (o crea) el identificador
 * seudonimizado del trabajador (operario_seudonimo — la única tabla que
 * guarda la correspondencia con operario.id) y la medición se guarda contra
 * ese seudónimo, no contra el operario.
 *
 * H0010/H0011/H0012: una vez persistida, la medición se entrega al Motor de
 * Reglas (motorReglas.service) para detectar fatiga, sobreesfuerzo e
 * inactividad prolongada contra los umbrales vigentes (H0023), y centralizar
 * lo detectado en alertas y notificaciones (H0013/H0015).
 */
const auditarPersistencia = ({ medicion, ipOrigen }) => logAuditoriaRepository
  .registrar({
    idUsuario: null, // origen: gateway autenticado por token de dispositivo
    tablaAfectada: 'medicion',
    idRegistro: medicion.id,
    operacion: 'CREATE',
    ipOrigen: ipOrigen || null,
    detalle: `Medición del seudónimo ${medicion.id_seudonimo} (wearable ${medicion.id_dispositivo}).`,
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
    const { idTrabajador, ...medicionSinIdentidad } = await validacionDatosService.validarPaquete(paquete);

    // H0020, criterios 1 y 2: se asocia al seudónimo (creándolo si es la
    // primera medición de este trabajador), no a operario.id directamente.
    const seudonimo = await operarioSeudonimoRepository.obtenerOCrearPorOperario(idTrabajador);

    const creada = await medicionRepository.crear({
      ...medicionSinIdentidad,
      idSeudonimo: seudonimo.id,
    });
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

    // H0010/H0011/H0012/H0013: el Motor de Reglas evalúa la medición ya
    // persistida contra los umbrales vigentes (H0023). Best-effort: un fallo
    // acá nunca debe romper la respuesta 201 al gateway (escenario "Error al
    // registrar alerta" de H0013).
    await motorReglasService.evaluar(creada).catch((err) => {
      console.error('[mediciones.service] El Motor de Reglas falló al evaluar la medición:', err.message);
    });

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

// H0020, criterio 3: los biodatos siguen siendo recuperables para consulta
// por usuarios autorizados — el llamador (controller detrás de auth +
// authorize) pide por idTrabajador y acá se resuelve al seudónimo real. Si
// el trabajador nunca tuvo una medición, no tiene seudónimo todavía: no hay
// nada que listar (no se crea uno solo para leer).
const listarMedicionesDeTrabajador = async (idTrabajador, filtros) => {
  const seudonimo = await operarioSeudonimoRepository.obtenerPorOperario(idTrabajador);
  if (!seudonimo) return [];
  return await medicionRepository.listarPorSeudonimo(seudonimo.id, filtros);
};

module.exports = {
  registrarMedicion,
  listarMediciones,
  listarMedicionesDeTrabajador,
};
