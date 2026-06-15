const API_URL = 'https://safeplace-backend.onrender.com/api/v1';

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const toggleBtn     = document.getElementById('togglePassword');
const eyeIcon       = document.getElementById('eyeIcon');
const loginBtn      = document.getElementById('loginBtn');
const errorMsg      = document.getElementById('errorMsg');

function showError(msg) { errorMsg.textContent = msg; }
function clearError()   { errorMsg.textContent = ''; }

async function handleLogin() {
  clearError();

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!username) { showError('Por favor ingrese su usuario.'); usernameInput.focus(); return; }
  if (!password) { showError('Por favor ingrese su contraseña.'); passwordInput.focus(); return; }

  loginBtn.disabled    = true;
  loginBtn.textContent = 'Verificando...';

  try {
    const res  = await fetch(`${API_URL}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError('Usuario o contraseña incorrectos.');
      passwordInput.value  = '';
      passwordInput.focus();
      loginBtn.disabled    = false;
      loginBtn.textContent = 'Ingresar';
      return;
    }

    sessionStorage.setItem('token',    data.token);
    sessionStorage.setItem('userName', data.user.email);
    sessionStorage.setItem('userRole', data.user.role);

    loginBtn.textContent = '✓ Acceso concedido';

    setTimeout(() => {
      document.body.innerHTML = `
        <div class="loading-screen">
          <div class="loading-screen__spinner"></div>
          <p class="loading-screen__text">Cargando sistema…</p>
        </div>
      `;
      setTimeout(() => {
        const role = data.user.role;
        if (role === 'admin')           window.location.href = 'Admin-Home.html';
        else if (role === 'supervisor') window.location.href = 'Supervisor-Home.html';
        else                            window.location.href = 'Seguridad-Home.html';
      }, 1500);
    }, 800);

  } catch (err) {
    showError('Error de conexión. Intente nuevamente.');
    loginBtn.disabled    = false;
    loginBtn.textContent = 'Ingresar';
  }
}

loginBtn.addEventListener('click', handleLogin);

[usernameInput, passwordInput].forEach(input => {
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  input.addEventListener('input', clearError);
});
