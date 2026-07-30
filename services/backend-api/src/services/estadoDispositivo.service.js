const historialEstadoDispositivoRepository = require('../repositories/historialEstadoDispositivo.repository');

/**
 * H0006: "si no se reciben datos durante más de 5 minutos, se registra
 * evento de desconexión". Es una inferencia sobre datos que el backend ya
 * tiene (no depende de que el hub reporte nada) — se corre periódicamente
 * desde server.js.
 */
const MINUTOS_INACTIVIDAD = Number(process.env.DESCONEXION_MINUTOS) || 5;

const chequearInactividad = async () => {
  const inactivos = await historialEstadoDispositivoRepository.listarDispositivosInactivos(
    MINUTOS_INACTIVIDAD,
  );

  for (const { id_dispositivo: idDispositivo } of inactivos) {
    await historialEstadoDispositivoRepository.registrarEstado(idDispositivo, 'DESCONECTADO');
  }

  return inactivos.length;
};

module.exports = {
  chequearInactividad,
  MINUTOS_INACTIVIDAD,
};
