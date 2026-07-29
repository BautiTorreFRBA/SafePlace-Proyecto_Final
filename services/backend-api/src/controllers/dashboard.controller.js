const dashboardRepository = require('../repositories/dashboard.repository');
const usuarioRepository = require('../repositories/usuario.repository');

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

const actualizarEmpleado = async (req, res, next) => {
  try {
    const idEmpresa = req.user?.idEmpresa;
    const empleado = await dashboardRepository.actualizarEmpleado(req.params.id, {
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      legajo: req.body.legajo,
      area: req.body.area,
      idEmpresa,
    });

    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }

    res.json({
      message: 'Empleado actualizado correctamente.',
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

const actualizarUsuario = async (req, res, next) => {
  try {
    const usuario = await usuarioRepository.actualizarUsuario(req.params.id, req.body);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({
      message: 'Usuario actualizado correctamente.',
      data: usuario,
    });
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
  getEmpresas,
  getEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  getUsuarios,
  actualizarUsuario,
  getMediciones,
  getDispositivos,
  getAlertas,
};
