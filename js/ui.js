/* RUMA — ui.js
 * Komponen tampilan bersama: toast, modal, konfirmasi. */
const UI = (() => {
  function host() {
    let h = document.getElementById('toastHost');
    if (!h) {
      h = document.createElement('div');
      h.id = 'toastHost';
      h.className = 'toast-host';
      h.setAttribute('aria-live', 'polite');
      document.body.appendChild(h);
    }
    return h;
  }

  function toast(msg, type = 'info', ms = 4200) {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    host().appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  }

  function modal({ title, body = '', actions = [], wide = false }) {
    const prev = document.activeElement;
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}" tabindex="-1">
        <header class="modal-head"><h3>${U.esc(title)}</h3><button type="button" class="icon-btn" data-x aria-label="Tutup">✕</button></header>
        <div class="modal-body"></div>
        <footer class="modal-foot"></footer>
      </div>`;
    const bodyEl = bd.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    const foot = bd.querySelector('.modal-foot');

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      bd.remove();
      if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('modal-open');
      if (prev && prev.focus) prev.focus();
    }

    actions.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.kind || 'ghost');
      b.textContent = a.label;
      b.addEventListener('click', () => { if (a.onClick) a.onClick(close, bd); else close(); });
      foot.appendChild(b);
    });
    if (!actions.length) foot.remove();

    bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('[data-x]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bd);
    document.body.classList.add('modal-open');
    const first = bd.querySelector('input,textarea,select') || bd.querySelector('.modal');
    first.focus();
    return { close, el: bd };
  }

  function confirm(message, { title = 'Konfirmasi', okLabel = 'Ya, lanjutkan', danger = false } = {}) {
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (!done) { done = true; resolve(v); } };
      const m = modal({
        title,
        body: `<p>${U.esc(message)}</p>`,
        actions: [
          { label: 'Batal', kind: 'ghost', onClick: close => { close(); finish(false); } },
          { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: close => { close(); finish(true); } },
        ],
      });
      m.el.addEventListener('click', e => { if (e.target === m.el || e.target.closest('[data-x]')) finish(false); });
    });
  }

  return { toast, modal, confirm };
})();
