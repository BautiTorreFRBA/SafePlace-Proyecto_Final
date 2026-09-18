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
    areaSupervisada: usuario.area_supervisada || null,
    turnosSupervisados: usuario.turnos_supervisados || [],
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
      areaSupervisada: payload.areaSupervisada,
      turnosSupervisados: payload.turnosSupervisados,
    },
  };
};

const crearUsuario = async (payload) => {
  const { nombre, apellido, email, password, id_empresa, rol, area_supervisada, turnos_supervisados, activo } = payload || {};

  if (!nombre || !apellido || !email || !password || !id_empresa || !rol) {
    throw createHttpError(400, 'Faltan campos obligatorios.', 'VALIDACION_DATOS');
  }

  const rolNormalizado = normalizeRoleName(rol);
  const turnos = Array.isArray(turnos_supervisados) ? [...new Set(turnos_supervisados.map((turno) => String(turno).trim().toLowerCase()))] : [];
  if (rolNormalizado === 'supervisor' && (!String(area_supervisada || '').trim() || turnos.length === 0)) {
    throw createHttpError(400, 'Para un supervisor se deben indicar el área y al menos un turno.', 'ALCANCE_SUPERVISOR_REQUERIDO');
  }
  if (turnos.some((turno) => !['mañana', 'tarde', 'noche'].includes(turno))) {
    throw createHttpError(400, 'Los turnos del supervisor no son válidos.', 'TURNOS_SUPERVISOR_INVALIDOS');
  }

  const usuarioExistente = await usuarioRepository.buscarPorEmailParaLogin(email);
  if (usuarioExistente) {
    throw createHttpError(409, 'Ya existe un usuario con ese email.', 'USUARIO_DUPLICADO');
  }

  const usuario = await usuarioRepository.crearUsuario({
    nombre,
    apellido,
    email,
    password,
    id_empresa,
    rol,
    area_supervisada: rolNormalizado === 'supervisor' ? String(area_supervisada).trim() : null,
    turnos_supervisados: rolNormalizado === 'supervisor' ? turnos : null,
    activo: activo !== false,
  });

  return {
    message: 'Usuario creado correctamente.',
    user: usuario,
  };
};

module.exports = {
  login,
  crearUsuario,
};
