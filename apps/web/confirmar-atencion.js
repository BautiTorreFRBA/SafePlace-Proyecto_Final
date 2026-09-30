// Diálogo de confirmación previo a atender o cerrar una EMERGENCIA / SÚPER EMERGENCIA.
// Uso: if (await window.confirmarAtencion('Nombre Apellido')) { ...atender... }
(function () {
  let abierto = null;

  window.confirmarAtencion = function confirmarAtencion(nombre) {
    if (abierto) return abierto;
    abierto = new Promise((resolve) => {
      const previo = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'confirmar-atencion';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'confirmarAtencionTitulo');
      overlay.innerHTML = `<div class="confirmar-atencion__panel">
        <h2 class="confirmar-atencion__titulo" id="confirmarAtencionTitulo"></h2>
        <p class="confirmar-atencion__texto">Al confirmar, la alerta se marca como atendida.</p>
        <div class="confirmar-atencion__acciones">
          <button type="button" class="confirmar-atencion__btn confirmar-atencion__btn--ok">Sí, está mejor</button>
          <button type="button" class="confirmar-atencion__btn confirmar-atencion__btn--cancelar">Cancelar</button>
        </div>
      </div>`;
      overlay.querySelector('#confirmarAtencionTitulo').textContent = `¿Está mejor ${nombre || 'el operario'}?`;

      const onKey = (event) => { if (event.key === 'Escape') cerrar(false); };
      function cerrar(valor) {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        if (previo && typeof previo.focus === 'function') previo.focus();
        abierto = null;
        resolve(valor);
      }

      overlay.querySelector('.confirmar-atencion__btn--ok').addEventListener('click', () => cerrar(true));
      const cancelar = overlay.querySelector('.confirmar-atencion__btn--cancelar');
      cancelar.addEventListener('click', () => cerrar(false));
      overlay.addEventListener('click', (event) => { if (event.target === overlay) cerrar(false); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      cancelar.focus(); // el foco inicial queda en Cancelar: un Enter de más no atiende la alerta
    });
    return abierto;
  };
})();
