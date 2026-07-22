const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000/api/v1';

const ROLE_ROUTES = {
  admin: 'Admin-Home.html',
  supervisor: 'Supervisor-Home.html',
  seguridad: 'Seguridad-Home.html',
};

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const toggleBtn = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');

function showError(msg) {
  errorMsg.textContent = msg;
}

function clearError() {
  errorMsg.textContent = '';
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getHomeByRole(role) {
  return ROLE_ROUTES[normalizeRole(role)] || null;
}

function setLoadingState(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtn.textContent = isLoading ? 'Ingresando...' : 'Ingresar';
}

async function handleLogin() {
  clearError();

  const email = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    showError('Por favor ingrese su correo electrónico.');
    usernameInput.focus();
    return;
  }

  if (!password) {
    showError('Por favor ingrese su contraseña.');
    passwordInput.focus();
    return;
  }

  setLoadingState(true);
  let loginSucceeded = false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        showError(data.error || 'Usuario o contraseña incorrectos.');
      } else if (response.status === 403) {
        showError(data.error || 'La cuenta se encuentra deshabilitada.');
      } else {
        showError(data.error || 'No se pudo iniciar sesión.');
      }

      passwordInput.value = '';
      passwordInput.focus();
      return;
    }

    const role = normalizeRole(data.role);
    const homeRoute = getHomeByRole(role);

    if (!homeRoute) {
      showError('El usuario no tiene un rol válido para ingresar al sistema.');
      return;
    }

    sessionStorage.setItem('authToken', data.token);
    sessionStorage.setItem('userRole', role);
    sessionStorage.setItem('userId', String(data.user?.id ?? ''));
    sessionStorage.setItem('userIdEmpresa', String(data.user?.idEmpresa ?? ''));
    sessionStorage.setItem('userEmail', data.user?.email ?? email);
    sessionStorage.setItem(
      'userName',
      `${data.user?.nombre ?? ''} ${data.user?.apellido ?? ''}`.trim() || email,
    );

    loginSucceeded = true;
    document.body.innerHTML = `
      <div class="loading-screen">
        <div class="loading-screen__spinner"></div>
        <p class="loading-screen__text">Cargando sistema...</p>
      </div>
    `;

    setTimeout(() => {
      window.location.href = homeRoute;
    }, 900);
  } catch (error) {
    showError('No se pudo conectar con el servidor.');
  } finally {
    if (!loginSucceeded) {
      setLoadingState(false);
    }
  }
}

loginBtn.addEventListener('click', handleLogin);

[usernameInput, passwordInput].forEach((input) => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });

  input.addEventListener('input', clearError);
});

toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  eyeIcon.innerHTML = isPassword
    ? '<path d="M17.94 17.94A10.86 10.86 0 0 1 12 20C5 20 1 12 1 12a21.77 21.77 0 0 1 5.08-6.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.79 21.79 0 0 1-2.67 3.88M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="M1 1l22 22"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
});
