jest.mock('../../src/repositories/usuario.repository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../../src/repositories/usuario.repository');
const authService = require('../../src/services/auth.service');

describe('auth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('token-de-prueba');
  });

  it('permite el acceso de consulta general a una cuenta sin rol', async () => {
    usuarioRepository.buscarPorEmailParaLogin.mockResolvedValue({
      id: 7,
      id_empresa: 2,
      email: 'sin-rol@safeplace.test',
      password_hash: 'hash',
      activo: true,
      roles: [],
    });

    const resultado = await authService.login({
      email: 'sin-rol@safeplace.test',
      password: 'secreta',
    });

    expect(resultado).toMatchObject({ role: 'sin_rol', token: 'token-de-prueba' });
    expect(resultado.user.roles).toEqual([]);
    expect(jwt.sign.mock.calls[0][0]).toMatchObject({ role: 'sin_rol', roles: [] });
  });
});
