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

module.exports = {
  login,
};
