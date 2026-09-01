const reglaAlertaRepository = require('../repositories/reglaAlerta.repository');
const umbralRiesgoRepository = require('../repositories/umbralRiesgo.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');

const REGLAS = ['FATIGA', 'INACTIVIDAD', 'SOBREESFUERZO'];

const validarReglas = (reglas) => {
  if (!reglas || typeof reglas !== 'object') {
    const error = new Error('La configuración de reglas es obligatoria.');
    error.status = 400;
    throw error;
  }
  for (const tipo of REGLAS) {
    if (!reglas[tipo] || typeof reglas[tipo] !== 'object') {
      const error = new Error(`Falta la configuración de ${tipo}.`);
      error.status = 400;
      throw error;
    }
    const valores = Object.entries(reglas[tipo])
      .filter(([nombre]) => !(tipo === 'SOBREESFUERZO' && nombre === 'nivelActividad'))
      .map(([, valor]) => valor);
    if (tipo === 'SOBREESFUERZO' && !['high', 'medium', 'low'].includes(reglas[tipo].nivelActividad)) {
      const error = new Error('El nivel de actividad de SOBREESFUERZO no es válido.');
      error.status = 400;
      throw error;
    }
    if (valores.length === 0 || valores.some((valor) => !Number.isFinite(Number(valor)) || Number(valor) <= 0)) {
      const error = new Error(`Los parámetros de ${tipo} deben ser números positivos.`);
      error.status = 400;
      throw error;
    }
  }
};

const obtener = async () => reglaAlertaRepository.listar();

const configurar = async (reglas, actor) => {
  validarReglas(reglas);
  const registros = await reglaAlertaRepository.guardarTodas({
    reglas,
    idUsuario: actor?.id,
  });

  // El motor actual usa estos tres valores normalizados. Se mantiene
  // sincronizado para que los cambios administrativos apliquen a las nuevas
  // mediciones y a la detección de inactividad.
  await umbralRiesgoRepository.crear({
    fcFatiga: Number(reglas.FATIGA.fcCritico),
    minutosFatiga: Number(reglas.FATIGA.horasConsecutivas) * 60,
    fcSobreesfuerzo: Number(reglas.SOBREESFUERZO.umbralFc),
    actividadSobreesfuerzo: reglas.SOBREESFUERZO.nivelActividad === 'high' ? 0.8 : reglas.SOBREESFUERZO.nivelActividad === 'medium' ? 0.5 : 0.2,
    minutosInactividad: Number(reglas.INACTIVIDAD.alertaDespues),
    minutosDesconexionTolerada: Number(reglas.INACTIVIDAD.maxInactividad),
    idUsuario: actor?.id,
  });

  await logAuditoriaRepository.registrar({
    idUsuario: actor?.id,
    tablaAfectada: 'regla_alerta',
    idRegistro: null,
    operacion: 'UPDATE',
    ipOrigen: actor?.ip,
    detalle: 'Configuración actualizada para FATIGA, INACTIVIDAD y SOBREESFUERZO.',
  }).catch(() => {});

  return registros;
};

module.exports = { obtener, configurar };
