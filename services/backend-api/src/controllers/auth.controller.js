const authService = require('../services/auth.service');

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const crearUsuario = async (req, res, next) => {
  try {
    const result = await authService.crearUsuario(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// Alcance vigente del usuario autenticado (el middleware ya lo trae de la base).
const me = (req, res) => {
  res.status(200).json({
    data: {
      role: req.user.role,
      areaSupervisada: req.user.areaSupervisada || null,
      turnosSupervisados: req.user.turnosSupervisados || [],
    },
  });
};

module.exports = {
  login,
  me,
  crearUsuario,
};
