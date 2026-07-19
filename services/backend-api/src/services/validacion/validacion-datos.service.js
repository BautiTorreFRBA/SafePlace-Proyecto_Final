const crypto = require('crypto');
const medicionRepository = require('../../repositories/medicion.repository');
const asignacionDispositivoRepository = require('../../repositories/asignacionDispositivo.repository');
const logAuditoriaRepository = require('../../repositories/logAuditoria.repository');
const consentimientoCache = require('./consentimiento.cache');
const { ErrorValidacion, MOTIVOS } = require('./errores');

/**
 * Servicio de Validación de Datos — V1 (RF-04 / H0008 / PB-04, Release 2).
 *
 * Intercepta todo paquete de mediciones del gateway antes de persistirlo o
 * evaluarlo contra reglas de negocio. Las validaciones se aplican en orden
 * como un pipeline de funciones independientes: agregar o modificar una regla
 * es agregar/editar una entrada de PIPELINE, sin tocar ingesta, almacenamiento
 * ni (a futuro) el motor de reglas (RNF de mantenibilidad).
 *
 * Contrato de entrada (paquete JSON del gateway, ya autenticado por token de
 * dispositivo):
 *   {
 *     idDispositivo:      number  (obligatorio — identificador del wearable,
 *                                  id interno de la tabla dispositivo),
 *     timestamp:          string  (obligatorio — fecha/hora de captura ISO
 *                                  generada por el wearable/gateway),
 *     frecuenciaCardiaca: number  (obligatorio — BPM),
 *     nivelActividad:     number  (opcional),
 *     nivelInactividad:   number  (opcional),
 *     temperaturaCorporal:number  (opcional),
 *     spo2:               number  (opcional),
 *   }
 *
 * Salida (paquete válido): la medición normalizada lista para el Servicio de
 * Almacenamiento, con fechaHora = timestamp de RECEPCIÓN asignado por el
 * backend (RF-03; el timestamp del dispositivo se conserva como
 * fechaHoraCaptura, dato adicional) e idTrabajador resuelto desde la
 * asignación vigente del dispositivo (no se confía en el emisor).
 *
 * Salida (paquete inválido): lanza ErrorValidacion tipado con motivo; el
 * orquestador (mediciones.service) audita el descarte salvo en el bloqueo
 * por privacidad, que se descarta en memoria (RNF-09 / Ley 25.326).
 */

// Rango biológico lógico fijo del MVP (H0008; no confundir con los umbrales
// configurables de fatiga/sobreesfuerzo de H0023, que son de V2/Release 3).
const FC_MINIMA_BPM = 30;
const FC_MAXIMA_BPM = 220;

const esNumeroFinito = (v) => typeof v === 'number' && Number.isFinite(v);

// --- Validaciones del pipeline (en el orden exigido por RF-04/H0008) ---

// 1. Estructura del paquete: tipos de datos correctos. El caso "JSON
//    corrupto" (no parseable) se intercepta antes, en el body parser de
//    Express, y se audita vía auditarPaqueteCorrupto().
const validarEstructura = async (paquete) => {
  if (typeof paquete !== 'object' || paquete === null || Array.isArray(paquete)) {
    throw new ErrorValidacion(MOTIVOS.ESTRUCTURA_INVALIDA, 'El paquete no es un objeto JSON válido.');
  }

  const camposNumericos = ['idDispositivo', 'frecuenciaCardiaca', 'nivelActividad', 'nivelInactividad', 'temperaturaCorporal', 'spo2'];
  for (const campo of camposNumericos) {
    const valor = paquete[campo];
    if (valor !== undefined && valor !== null && !esNumeroFinito(valor)) {
      throw new ErrorValidacion(
        MOTIVOS.ESTRUCTURA_INVALIDA,
        `Tipo de dato incorrecto en el campo "${campo}": se esperaba un número.`,
      );
    }
  }

  if (paquete.timestamp !== undefined && paquete.timestamp !== null) {
    const fecha = new Date(paquete.timestamp);
    if (Number.isNaN(fecha.getTime())) {
      throw new ErrorValidacion(
        MOTIVOS.ESTRUCTURA_INVALIDA,
        'Tipo de dato incorrecto en el campo "timestamp": no es una fecha válida.',
      );
    }
  }
};

// 2. Campos obligatorios (H0008: identificador del wearable y timestamp;
//    la frecuencia cardíaca es el biodato central de la medición según H0006 —
//    un paquete sin ella es una "estructura de datos incompleta" de RF-04).
const validarCamposObligatorios = async (paquete) => {
  const faltantes = [];
  if (paquete.idDispositivo === undefined || paquete.idDispositivo === null) faltantes.push('idDispositivo');
  if (paquete.timestamp === undefined || paquete.timestamp === null) faltantes.push('timestamp');
  if (paquete.frecuenciaCardiaca === undefined || paquete.frecuenciaCardiaca === null) faltantes.push('frecuenciaCardiaca');

  if (faltantes.length > 0) {
    throw new ErrorValidacion(
      MOTIVOS.CAMPOS_INCOMPLETOS,
      `Campos obligatorios ausentes: ${faltantes.join(', ')}.`,
    );
  }
};

// 3. Rango biológico lógico: 30–220 BPM inclusive (H0008).
const validarRangoBiologico = async (paquete) => {
  const fc = paquete.frecuenciaCardiaca;
  if (fc < FC_MINIMA_BPM || fc > FC_MAXIMA_BPM) {
    throw new ErrorValidacion(
      MOTIVOS.FUERA_DE_RANGO,
      `Frecuencia cardíaca fuera del rango biológico lógico (${FC_MINIMA_BPM}-${FC_MAXIMA_BPM} BPM).`,
    );
  }
};

// 4. Duplicados: mismo wearable + misma marca de captura ya persistida
//    (ver justificación del criterio en la migración
//    20260719000001_add-medicion-fecha-captura.js). Consulta por índice único.
const validarDuplicado = async (paquete) => {
  const duplicado = await medicionRepository.existeDuplicado(
    paquete.idDispositivo,
    new Date(paquete.timestamp),
  );
  if (duplicado) {
    throw new ErrorValidacion(
      MOTIVOS.DUPLICADO,
      'Registro duplicado: ya existe una medición de este wearable con la misma marca de captura.',
      { status: 409 },
    );
  }
};

// 5. Asignación del wearable y consentimiento activo. El wearable debe estar
//    asociado a un trabajador (H0006/H0008 "wearable inexistente": descartado
//    y auditado) y ese trabajador debe tener consentimiento otorgado
//    (Anexo de reglas de negocio, bloqueo por privacidad Ley 25.326): si el
//    flag es FALSE o no existe, el paquete se descarta EN MEMORIA, sin
//    persistir ni auditar el biodato (RNF-09; auditar: false).
const validarAsignacionYConsentimiento = async (paquete, contexto) => {
  const asignacion = await asignacionDispositivoRepository.obtenerVigentePorDispositivo(
    paquete.idDispositivo,
  );
  if (!asignacion) {
    throw new ErrorValidacion(
      MOTIVOS.DISPOSITIVO_INVALIDO,
      'El wearable no existe o no tiene un trabajador asignado.',
    );
  }

  const consentimientoActivo = await consentimientoCache.tieneConsentimientoActivo(
    asignacion.id_trabajador,
  );
  if (!consentimientoActivo) {
    throw new ErrorValidacion(
      MOTIVOS.SIN_CONSENTIMIENTO,
      'Ingesta bloqueada por política de privacidad.',
      { status: 403, auditar: false },
    );
  }

  contexto.idTrabajador = asignacion.id_trabajador;
};

const PIPELINE = [
  validarEstructura,
  validarCamposObligatorios,
  validarRangoBiologico,
  validarDuplicado,
  validarAsignacionYConsentimiento,
];

/**
 * Ejecuta el pipeline completo. Devuelve la medición normalizada para el
 * Servicio de Almacenamiento o lanza ErrorValidacion.
 */
const validarPaquete = async (paquete, { fechaRecepcion = new Date() } = {}) => {
  const contexto = {};
  for (const validar of PIPELINE) {
    await validar(paquete, contexto);
  }

  return {
    idTrabajador: contexto.idTrabajador,
    idDispositivo: paquete.idDispositivo,
    fechaHora: fechaRecepcion, // timestamp oficial de recepción (RF-03)
    fechaHoraCaptura: new Date(paquete.timestamp),
    frecuenciaCardiaca: paquete.frecuenciaCardiaca,
    nivelActividad: paquete.nivelActividad ?? null,
    nivelInactividad: paquete.nivelInactividad ?? null,
    temperaturaCorporal: paquete.temperaturaCorporal ?? null,
    spo2: paquete.spo2 ?? null,
  };
};

// --- Auditoría de descartes (H0008: "Los registros inválidos quedan auditados") ---

const hashPaquete = (contenido) =>
  crypto.createHash('sha256').update(contenido).digest('hex');

/**
 * Registra el descarte en la tabla log_auditoria existente (no se crea un
 * mecanismo de logging paralelo). Minimización de datos (Ley 25.326): se
 * registra motivo, identificador del wearable extraíble del paquete y el
 * hash SHA-256 del paquete original para trazabilidad — nunca el valor
 * biométrico asociado a una identidad, ni el id del trabajador.
 * Best-effort: una falla de auditoría se loguea pero no corta el pipeline.
 */
const auditarDescarte = async (paquete, error, { ipOrigen } = {}) => {
  try {
    const detalle = {
      motivo: error.motivo,
      mensaje: error.message,
      idDispositivo: paquete && esNumeroFinito(paquete.idDispositivo) ? paquete.idDispositivo : null,
      timestampCaptura: paquete && paquete.timestamp ? String(paquete.timestamp) : null,
      hashPaquete: hashPaquete(JSON.stringify(paquete ?? null)),
    };
    await logAuditoriaRepository.registrar({
      idUsuario: null, // origen: gateway autenticado por token de dispositivo, no un usuario humano
      tablaAfectada: 'medicion',
      operacion: 'DESCARTE_VALIDACION',
      ipOrigen: ipOrigen || null,
      detalle: JSON.stringify(detalle),
    });
  } catch (errAuditoria) {
    console.error('[validacion-datos] No se pudo auditar el descarte:', errAuditoria.message);
  }
};

/**
 * Auditoría del caso "JSON corrupto" (RF-04): el body parser rechaza el
 * paquete antes de llegar al pipeline, así que se registra desde el manejador
 * de errores con el hash del cuerpo crudo recibido.
 */
const auditarPaqueteCorrupto = async ({ ipOrigen, cuerpoCrudo } = {}) => {
  try {
    const detalle = {
      motivo: MOTIVOS.ESTRUCTURA_INVALIDA,
      mensaje: 'JSON corrupto: el cuerpo del paquete no pudo parsearse.',
      idDispositivo: null,
      timestampCaptura: null,
      hashPaquete: hashPaquete(cuerpoCrudo || ''),
    };
    await logAuditoriaRepository.registrar({
      idUsuario: null,
      tablaAfectada: 'medicion',
      operacion: 'DESCARTE_VALIDACION',
      ipOrigen: ipOrigen || null,
      detalle: JSON.stringify(detalle),
    });
  } catch (errAuditoria) {
    console.error('[validacion-datos] No se pudo auditar el paquete corrupto:', errAuditoria.message);
  }
};

module.exports = {
  validarPaquete,
  auditarDescarte,
  auditarPaqueteCorrupto,
  FC_MINIMA_BPM,
  FC_MAXIMA_BPM,
};
