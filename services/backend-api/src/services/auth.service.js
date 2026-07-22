const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../repositories/usuario.repository');

function createHttpError(status, message, motivo) {
  const error = new Error(message);
  error.status = status;
  if (motivo) {
    error.motivo = motivo;
  }
  return error;
}

function normalizeRoleName(roleValue) {
  if (!roleValue) return null;
  return String(roleValue).trim().toLowerCase();
}

function extractRoleName(roleObject) {
  if (!roleObject || typeof roleObject !== 'object') {
    return null;
  }

  const candidateFields = [
    'nombre',
    'rol',
    'codigo',
    'slug',
    'name',
    'tipo',
  ];

  for (const field of candidateFields) {
    if (roleObject[field]) {
      return normalizeRoleName(roleObject[field]);
    }
  }

  return null;
}

const login = async ({ email, password }) => {
  if (!email || !password) {
    throw createHttpError(400, 'Email y contraseña son obligatorios.', 'VALIDACION_DATOS');
  }

  const usuario = await usuarioRepository.buscarPorEmailParaLogin(email);

  if (!usuario) {
    throw createHttpError(401, 'Credenciales inválidas.', 'CREDENCIALES_INVALIDAS');
  }

  if (!usuario.activo) {
    throw createHttpError(403, 'Usuario inactivo.', 'USUARIO_INACTIVO');
  }

  const passwordOk = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordOk) {
    throw createHttpError(401, 'Credenciales inválidas.', 'CREDENCIALES_INVALIDAS');
  }

  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];
  const primaryRole = extractRoleName(roles[0]);

  if (!primaryRole) {
    throw createHttpError(403, 'La cuenta no tiene un rol asignado.', 'ROL_NO_ASIGNADO');
  }

  const payload = {
    sub: usuario.id,
    idEmpresa: usuario.id_empresa,
    email: usuario.email,
    role: primaryRole,
    roles: roles.map(extractRoleName).filter(Boolean),
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

  return {
    token,
    role: primaryRole,
    user: {
      id: usuario.id,
      idEmpresa: usuario.id_empresa,
      nombre: usuario.usuario_nombre,
      apellido: usuario.usuario_apellido,
      email: usuario.email,
      activo: usuario.activo,
      roles: payload.roles,
    },
  };
};

module.exports = {
  login,
};
