/* Convierte selectores de operarios en campos buscables sin cambiar los IDs
 * ni los valores que consumen los formularios existentes. */
(function () {
  function activar(select) {
    if (!select || select.dataset.autocompleteReady === 'true') return;
    select.dataset.autocompleteReady = 'true';

    const input = document.createElement('input');
    const list = document.createElement('datalist');
    const inputId = `${select.id}Autocomplete`;
    const listId = `${inputId}List`;

    input.id = inputId;
    input.type = 'search';
    input.className = select.className;
    input.setAttribute('list', listId);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Buscar operario');
    list.id = listId;

    select.insertAdjacentElement('beforebegin', input);
    select.insertAdjacentElement('beforebegin', list);
    select.hidden = true;
    select.tabIndex = -1;
    document.querySelector(`label[for="${select.id}"]`)?.setAttribute('for', inputId);

    function actualizarOpciones() {
      const opciones = [...select.options];
      list.replaceChildren(...opciones
        .filter((option) => option.value)
        .map((option) => {
          const item = document.createElement('option');
          item.value = option.textContent.trim();
          return item;
        }));
      input.placeholder = opciones[0]?.textContent.trim() || 'Buscar operario...';
      input.disabled = select.disabled;
      if (!select.value) input.value = '';
    }

    function seleccionarCoincidencia() {
      const texto = input.value.trim();
      const opcion = [...select.options].find((item) => item.value && item.textContent.trim() === texto);
      if (opcion && select.value !== opcion.value) {
        select.value = opcion.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Mientras el usuario sigue escribiendo no debe conservarse la
      // selección anterior: el formulario sólo puede usar un operario que
      // haya sido elegido de las coincidencias.
      if (!opcion && select.value) {
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    input.addEventListener('input', seleccionarCoincidencia);
    input.addEventListener('change', seleccionarCoincidencia);
    select.addEventListener('change', () => {
      const opcion = select.options[select.selectedIndex];
      input.value = opcion?.value ? opcion.textContent.trim() : '';
    });
    new MutationObserver(actualizarOpciones).observe(select, { childList: true, subtree: true });
    actualizarOpciones();
  }

  document.querySelectorAll('[data-operario-autocomplete]').forEach(activar);
}());
