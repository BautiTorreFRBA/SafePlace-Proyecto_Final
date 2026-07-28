const dashboardRepository = require('../repositories/dashboard.repository');

const getEmpresas = async (req, res, next) => {
  try {
    const rows = await dashboardRepository.listarEmpresas();
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const getEmpleados = async (req, res, next) => {
  try {
    const rows = await dashboardRepository.listarEmpleados();
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const crearEmpleado = async (req, res, next) => {
  try {
    const idEmpresa = req.user?.idEmpresa;
    const empleado = await dashboardRepository.crearEmpleado({
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      legajo: req.body.legajo,
      area: req.body.area,
      idEmpresa,
    });

    res.status(201).json({
      message: 'Empleado creado correctamente.',
      data: empleado,
    });
  } catch (error) {
    next(error);
  }
};

const getUsuarios = async (req, res, next) => {
  try {
    const rows = await dashboardRepository.listarUsuarios();
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEmpresas,
  getEmpleados,
  crearEmpleado,
  getUsuarios,
};
