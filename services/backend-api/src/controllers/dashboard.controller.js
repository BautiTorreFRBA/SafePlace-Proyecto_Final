const dashboardRepository = require('../repositories/dashboard.repository');

const getEmpleados = async (req, res, next) => {
  try {
    const rows = await dashboardRepository.listarEmpleados();
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const getMediciones = async (req, res, next) => {
  try {
    const rows = await dashboardRepository.listarMediciones(req.query);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const getDispositivos = async (req, res, next) => {
  try {
    const rows = await dashboardRepository.listarDispositivos();
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const getAlertas = async (req, res, next) => {
  try {
    const rows = await dashboardRepository.listarAlertas(req.query);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEmpleados,
  getMediciones,
  getDispositivos,
  getAlertas,
};
