const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usersRepository = require('../repositories/users.repository');

async function login(email, password) {
  const user = await usersRepository.findByEmail(email);
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

async function register(email, password, role = 'operator') {
  const existing = await usersRepository.findByEmail(email);
  if (existing) throw Object.assign(new Error('Email already in use'), { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  return await usersRepository.create(email, passwordHash, role);
}

module.exports = { login, register };
