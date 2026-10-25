/* RUMA — auth.js
 * Login, daftar, penjaga halaman, dan pengalihan otomatis berdasarkan peran:
 *   admin  -> admin.html (mode admin; juga boleh membuka client.html)
 *   client -> client.html (mode client) */
const Auth = (() => {
  const home = u => (u.role === 'admin' ? 'admin.html' : 'client.html');

  function current() {
    const s = Store.session.get();
    return s ? Store.users.get(s.id) : null;
  }

  function login(identity, password) {
    const u = Store.users.byLogin(identity);
    if (!u || u.password !== password) return null;
    Store.session.set(u);
    return u;
  }

  function register(d) {
    const name = (d.name || '').trim();
    const username = (d.username || '').trim();
    const email = (d.email || '').trim();
    const errors = [];
    if (name.length < 3) errors.push('Nama lengkap minimal 3 karakter.');
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username)) errors.push('Username 3–20 karakter (huruf, angka, titik, garis bawah).');
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Format email tidak valid.');
    if (!(d.idNo || '').trim()) errors.push(U.idLabel(d.type) + ' wajib diisi.');
    if (d.type === 'external' && !/^[0-9+\-\s]{8,16}$/.test((d.phone || '').trim())) errors.push('No. HP wajib diisi untuk pengguna external (8–16 digit).');
    if ((d.password || '').length < 6) errors.push('Password minimal 6 karakter.');
    if (d.password !== d.password2) errors.push('Konfirmasi password tidak sama.');
    if (Store.users.byLogin(username)) errors.push('Username sudah dipakai.');
    if (Store.users.byLogin(email)) errors.push('Email sudah terdaftar.');
    if (errors.length) return { ok: false, errors };

    const user = Store.users.add({
      id: U.uid('u-'), role: 'client', type: d.type, name, username, email,
      password: d.password, idNo: d.idNo.trim(), phone: (d.phone || '').trim(),
    });
    Store.session.set(user);
    return { ok: true, user };
  }

  function guard(allowedRoles) {
    Store.seed();
    const u = current();
    if (!u) { location.replace('index.html'); return null; }
    if (!allowedRoles.includes(u.role)) { location.replace(home(u)); return null; }
    return u;
  }

  function redirect(u) { location.replace(home(u)); }
  function logout() { Store.session.clear(); location.replace('index.html'); }

  return { current, login, register, guard, redirect, logout, home };
})();
