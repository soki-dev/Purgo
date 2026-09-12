// Eigene Toast-/Dialog-Bausteine als Ersatz für alert()/confirm()/prompt(),
// damit Meldungen ins dunkle Design passen statt wie Browser-Popups auszusehen.

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function toast(message, type = 'info') {
  const container = getToastContainer();
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.textContent = message;
  container.appendChild(node);

  requestAnimationFrame(() => node.classList.add('toast-visible'));

  setTimeout(() => {
    node.classList.remove('toast-visible');
    setTimeout(() => node.remove(), 250);
  }, 4200);
}

function openModal({ title, message, body, confirmLabel, cancelLabel, danger, inputType }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-card';

    if (title) {
      const h = document.createElement('div');
      h.className = 'modal-title';
      h.textContent = title;
      card.appendChild(h);
    }

    if (message) {
      const p = document.createElement('div');
      p.className = 'modal-message';
      p.textContent = message;
      card.appendChild(p);
    }

    let input = null;
    if (inputType) {
      input = document.createElement('input');
      input.type = inputType;
      input.className = 'search-input modal-input';
      card.appendChild(input);
    }

    if (body) card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cleanup = (result) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    if (cancelLabel !== null) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.textContent = cancelLabel || 'Abbrechen';
      cancelBtn.addEventListener('click', () => cleanup(inputType ? null : false));
      actions.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = confirmLabel || 'OK';
    confirmBtn.addEventListener('click', () => cleanup(inputType ? (input ? input.value : true) : true));
    actions.appendChild(confirmBtn);

    card.appendChild(actions);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    function onKeyDown(e) {
      if (e.key === 'Escape') cleanup(inputType ? null : false);
      if (e.key === 'Enter' && (!input || document.activeElement === input)) cleanup(inputType ? (input ? input.value : true) : true);
    }
    document.addEventListener('keydown', onKeyDown);

    if (input) {
      setTimeout(() => input.focus(), 30);
    } else {
      setTimeout(() => confirmBtn.focus(), 30);
    }
  });
}

function showConfirm(message, { title, danger, confirmLabel } = {}) {
  return openModal({ title: title || 'Bitte bestätigen', message, danger, confirmLabel: confirmLabel || (danger ? 'Löschen' : 'OK') });
}

function showPrompt(message, { title, inputType = 'text' } = {}) {
  return openModal({ title: title || 'Eingabe', message, inputType, confirmLabel: 'OK' });
}
