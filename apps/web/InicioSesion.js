// Credenciales válidas de prueba
const USERS = {
  admin:      { password: 'admin123',  role: 'Admin' },
  supervisor: { password: 'super123',  role: 'Supervisor' },
  seguridad:  { password: 'seg123',    role: 'Seguridad' },
};

// Extraer datos
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const toggleBtn = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');

// ─── Mostrar / limpiar error ─────────────────────────────────────
function showError(msg) { errorMsg.textContent = msg; }

function clearError() { errorMsg.textContent = ''; }

// ─── Lógica de login ─────────────────────────────────────────────
function handleLogin() {
  clearError();

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!username) {
    showError('Por favor ingrese su usuario.');
    usernameInput.focus();
    return;
  }

  if (!password) {
    showError('Por favor ingrese su contraseña.');
    passwordInput.focus();
    return;
  }

  const user = USERS[username];

  if (!user || user.password !== password) {
    showError('Usuario o contraseña incorrectos.');
    passwordInput.value = '';
    passwordInput.focus();
    return;
  }

  // Login exitoso
  loginBtn.textContent = '✓ Acceso concedido';
  loginBtn.disabled = true;

setTimeout(() => {
  sessionStorage.setItem('userRole', user.role);
  sessionStorage.setItem('userName', usernameInput);

  // Solo HTML limpio, sin ningún estilo inline
  document.body.innerHTML = `
    <div class="loading-screen">
      <div class="loading-screen__spinner"></div>
      <p class="loading-screen__text">Cargando sistema…</p>
    </div>
  `;

  setTimeout(() => {
    window.location.href = 'Home.html';
  }, 1500);

}, 800);
}

// ─── Eventos ─────────────────────────────────────────────────────
loginBtn.addEventListener('click', handleLogin);

// Permitir login con Enter desde cualquier campo del formulario
[usernameInput, passwordInput].forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Limpiar error al escribir
  input.addEventListener('input', clearError);
});
