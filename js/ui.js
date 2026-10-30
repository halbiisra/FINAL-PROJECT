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

  /* ---------- Foto profil / inisial ---------- */
  const initial = name => (String(name || '?').trim().charAt(0) || '?').toUpperCase();

  function paintAvatar(el, u) {
    if (!el) return;
    if (u && u.photo) {
      el.classList.add('has-photo');
      el.style.backgroundImage = `url("${u.photo}")`;
      el.textContent = '';
    } else {
      el.classList.remove('has-photo');
      el.style.backgroundImage = '';
      el.textContent = initial(u && u.name);
    }
  }

  function avatarHtml(u, cls = '') {
    return u && u.photo
      ? `<span class="avatar has-photo ${cls}" style="background-image:url('${u.photo}')" aria-hidden="true"></span>`
      : `<span class="avatar ${cls}" aria-hidden="true">${U.esc(initial(u && u.name))}</span>`;
  }

  /* ---------- Ikon mata untuk semua input password ---------- */
  const EYE_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const EYE_OPEN = `<svg ${EYE_ATTR}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_SHUT = `<svg ${EYE_ATTR}><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

  function setReveal(btn, shown) {
    btn.innerHTML = shown ? EYE_SHUT : EYE_OPEN;          // tampil -> mata tertutup (klik untuk sembunyikan)
    btn.setAttribute('aria-label', shown ? 'Sembunyikan password' : 'Tampilkan password');
    btn.setAttribute('aria-pressed', String(shown));
  }

  function revealify(root = document) {
    const inputs = root.querySelectorAll ? [...root.querySelectorAll('input[type="password"]')] : [];
    inputs.forEach(input => {
      if (input.dataset.revealReady) return;
      input.dataset.revealReady = '1';
      const hadFocus = document.activeElement === input;
      let wrap = input.parentElement;
      if (!wrap.classList.contains('input-wrap')) {
        wrap = document.createElement('div');
        wrap.className = 'input-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reveal';
      setReveal(btn, false);
      btn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        setReveal(btn, show);
        input.focus();
      });
      wrap.appendChild(btn);
      if (hadFocus) input.focus();
    });
  }

  revealify(document);
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) revealify(n); })))
    .observe(document.body, { childList: true, subtree: true });

  return { toast, modal, confirm, initial, paintAvatar, avatarHtml, revealify };
})();
