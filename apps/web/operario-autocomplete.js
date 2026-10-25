/* Convierte selectores en campos buscables sin cambiar los valores que
 * consumen los formularios existentes. */
(function () {
  let nextId = 0;

  function activar(select) {
    if (!select || select.dataset.autocompleteReady === 'true') return;
    select.dataset.autocompleteReady = 'true';

    const wrapper = document.createElement('div');
    const input = document.createElement('input');
    const list = document.createElement('div');
    const inputId = select.id
      ? `${select.id}Autocomplete`
      : `selectAutocomplete${nextId += 1}`;
    const listId = `${inputId}List`;

    wrapper.className = 'select-autocomplete';
    input.id = inputId;
    input.type = 'text';
    input.className = select.className;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', select.getAttribute('aria-label') || 'Buscar o seleccionar una opción');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('aria-expanded', 'false');
    list.id = listId;
    list.className = 'select-autocomplete__list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;

    select.insertAdjacentElement('beforebegin', wrapper);
    wrapper.append(input, list, select);
    select.hidden = true;
    select.tabIndex = -1;
    if (select.id) {
      document.querySelector(`label[for="${select.id}"]`)?.setAttribute('for', inputId);
    }

    function opcionesFiltradas() {
      const texto = input.value.trim().toLocaleLowerCase('es');
      return [...select.options].filter((option) => option.value && option.textContent.trim().toLocaleLowerCase('es').includes(texto));
    }

    function mostrarOpciones() {
      const opciones = opcionesFiltradas();
      list.replaceChildren(...opciones.map((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'select-autocomplete__option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.value === select.value));
        item.textContent = option.textContent.trim();
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          input.value = option.textContent.trim();
          cerrarLista();
        });
        return item;
      }));
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function cerrarLista() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }

    function actualizarOpciones() {
      const opciones = [...select.options];
      input.placeholder = opciones[0]?.textContent.trim() || 'Buscar o seleccionar...';
      input.disabled = select.disabled;
      if (!select.value) input.value = '';
      if (!list.hidden) mostrarOpciones();
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

    input.addEventListener('focus', mostrarOpciones);
    input.addEventListener('click', mostrarOpciones);
    input.addEventListener('input', () => {
      seleccionarCoincidencia();
      mostrarOpciones();
    });
    input.addEventListener('change', seleccionarCoincidencia);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') cerrarLista();
      if (event.key === 'ArrowDown') { mostrarOpciones(); list.querySelector('button')?.focus(); }
    });
    select.addEventListener('change', () => {
      const opcion = select.options[select.selectedIndex];
      input.value = opcion?.value ? opcion.textContent.trim() : '';
    });
    document.addEventListener('pointerdown', (event) => {
      if (!wrapper.contains(event.target)) cerrarLista();
    });
    new MutationObserver(actualizarOpciones).observe(select, { childList: true, subtree: true });
    actualizarOpciones();
  }

  function activarTodos(root = document) {
    if (root.matches?.('select:not([data-no-autocomplete])')) activar(root);
    root.querySelectorAll?.('select:not([data-no-autocomplete])').forEach(activar);
  }

  activarTodos();

  // Algunos selectores se crean después de cargar la página (por ejemplo,
  // las filas de horarios). También deben conservar el mismo buscador.
  new MutationObserver((mutaciones) => {
    mutaciones.forEach((mutacion) => {
      mutacion.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) activarTodos(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
}());
