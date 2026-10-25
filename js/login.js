/* RUMA — login.js
 * Halaman masuk/daftar. Setelah berhasil, pengguna langsung diarahkan ke
 * mode admin atau mode client sesuai perannya. */
(() => {
  Store.seed();
  const existing = Auth.current();
  if (existing) { Auth.redirect(existing); return; }

  const $ = s => document.querySelector(s);
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');

  function showError(el, msgs) {
    const list = [].concat(msgs);
    el.hidden = false;
    el.innerHTML = list.length > 1 ? '<ul>' + list.map(m => `<li>${U.esc(m)}</li>`).join('') + '</ul>' : U.esc(list[0]);
  }

  /* Tab Login / Daftar */
  function setTab(which) {
    const isLogin = which === 'login';
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    $('#tabLogin').classList.toggle('active', isLogin);
    $('#tabRegister').classList.toggle('active', !isLogin);
    $('#tabLogin').setAttribute('aria-selected', isLogin);
    $('#tabRegister').setAttribute('aria-selected', !isLogin);
  }
  $('#tabLogin').addEventListener('click', () => setTab('login'));
  $('#tabRegister').addEventListener('click', () => setTab('register'));

  /* Lihat / sembunyikan password */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-reveal]');
    if (!b) return;
    const input = document.getElementById(b.dataset.reveal);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.textContent = show ? 'Sembunyi' : 'Lihat';
  });

  /* Akun contoh */
  document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
    const [u, p] = b.dataset.demo.split('|');
    $('#lUser').value = u; $('#lPass').value = p; $('#lPass').focus();
  }));

  /* Login */
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#loginError');
    const user = Auth.login($('#lUser').value, $('#lPass').value);
    if (!user) { showError(err, 'Username atau password salah.'); return; }
    err.hidden = true;
    Auth.redirect(user);
  });

  /* Daftar */
  function syncType() {
    const type = registerForm.elements.type.value;
    $('#rIdLabel').textContent = U.idLabel(type);
    $('#rPhoneField').hidden = type !== 'external';
  }
  registerForm.addEventListener('change', e => { if (e.target.name === 'type') syncType(); });
  syncType();

  registerForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = registerForm.elements;
    const res = Auth.register({
      type: f.type.value, name: f.name.value, idNo: f.idNo.value, phone: f.phone.value,
      email: f.email.value, username: f.username.value, password: f.password.value, password2: f.password2.value,
    });
    if (!res.ok) { showError($('#registerError'), res.errors); return; }
    Auth.redirect(res.user);
  });

  /* Lupa username / password */
  $('#forgotBtn').addEventListener('click', () => {
    const body = document.createElement('div');
    body.innerHTML = `
      <p class="muted">Masukkan email terdaftar. Jika cocok, kamu bisa langsung membuat password baru dan username-mu ditampilkan.</p>
      <div class="field"><label for="fEmail">Email terdaftar</label><input id="fEmail" type="email" autocomplete="email"></div>
      <div class="field" id="fNewWrap" hidden><label for="fNew">Password baru</label><input id="fNew" type="password" autocomplete="new-password"></div>
      <div class="form-error" id="fErr" role="alert" hidden></div>
      <p id="fInfo" class="ok-text" hidden></p>`;
    let matched = null;
    UI.modal({
      title: 'Lupa username atau password',
      body,
      actions: [
        { label: 'Tutup', kind: 'ghost' },
        {
          label: 'Lanjut', kind: 'primary',
          onClick: (close) => {
            const err = body.querySelector('#fErr');
            if (!matched) {
              const u = Store.users.byLogin(body.querySelector('#fEmail').value);
              if (!u || u.email.toLowerCase() !== body.querySelector('#fEmail').value.trim().toLowerCase()) {
                showError(err, 'Email tidak ditemukan.'); return;
              }
              matched = u; err.hidden = true;
              body.querySelector('#fNewWrap').hidden = false;
              const info = body.querySelector('#fInfo');
              info.hidden = false; info.textContent = `Username kamu: ${u.username}. Isi password baru lalu tekan Lanjut.`;
              body.querySelector('#fNew').focus();
              return;
            }
            const pw = body.querySelector('#fNew').value;
            if (pw.length < 6) { showError(err, 'Password baru minimal 6 karakter.'); return; }
            Store.users.update(matched.id, { password: pw });
            close();
            UI.toast('Password diperbarui. Silakan login.', 'ok');
            $('#lUser').value = matched.username; $('#lPass').value = ''; $('#lPass').focus();
          },
        },
      ],
    });
  });
})();
