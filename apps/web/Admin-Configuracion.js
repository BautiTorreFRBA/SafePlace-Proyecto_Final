// Botones ▲▼ de los spinners
document.querySelectorAll('.cfg-spinner__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const step  = parseInt(input.step) || 1;
    if (btn.dataset.dir === 'up')   input.value = +input.value + step;
    if (btn.dataset.dir === 'down') input.value = Math.max(0, +input.value - step);
  });
});

// Botón guardar con feedback visual
document.getElementById('btnGuardar').addEventListener('click', () => {
  const saved = document.getElementById('cfgSaved');
  saved.classList.add('cfg-saved--visible');
  setTimeout(() => saved.classList.remove('cfg-saved--visible'), 2500);
  // En producción: await fetch('/api/configuracion', { method: 'PUT', body: ... })
});