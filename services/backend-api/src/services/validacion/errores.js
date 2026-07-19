/**
 * Error tipado de descarte del Servicio de Validación de Datos (RF-04/H0008).
 *
 * - motivo: código estable del descarte, queda registrado en la auditoría.
 * - status: código HTTP con el que se responde al gateway.
 * - auditar: false únicamente para el bloqueo por privacidad (Ley 25.326 /
 *   RNF-09): ese descarte ocurre en memoria y no deja rastro del biodato.
 */
class ErrorValidacion extends Error {
  constructor(motivo, mensaje, { status = 400, auditar = true } = {}) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.motivo = motivo;
    this.status = status;
    this.auditar = auditar;
  }
}

const MOTIVOS = {
  ESTRUCTURA_INVALIDA: 'ESTRUCTURA_INVALIDA',
  CAMPOS_INCOMPLETOS: 'CAMPOS_INCOMPLETOS',
  FUERA_DE_RANGO: 'FUERA_DE_RANGO',
  DUPLICADO: 'DUPLICADO',
  DISPOSITIVO_INVALIDO: 'DISPOSITIVO_INVALIDO',
  SIN_CONSENTIMIENTO: 'SIN_CONSENTIMIENTO',
};

module.exports = { ErrorValidacion, MOTIVOS };
