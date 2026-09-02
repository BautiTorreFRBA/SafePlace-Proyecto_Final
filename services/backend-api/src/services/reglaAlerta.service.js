const reglaAlertaRepository = require('../repositories/reglaAlerta.repository');
const logAuditoriaRepository = require('../repositories/logAuditoria.repository');

const REGLAS = ['Fatiga', 'Inactividad', 'Sobreesfuerzo'];

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
    const valores = [reglas[tipo].valorMinimo, reglas[tipo].valorMaximo];
    if (valores.some((valor) => !Number.isFinite(Number(valor)) || Number(valor) <= 0)) {
      const error = new Error(`Los parámetros de ${tipo} deben ser números positivos.`);
      error.status = 400;
      throw error;
    }
  }
};

const obtener = async () => reglaAlertaRepository.listar();

const configurar = async (reglas, actor) => {
  validarReglas(reglas);
  const registros = await reglaAlertaRepository.guardarTodas({ reglas });

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
