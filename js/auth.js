/* RUMA — auth.js
 * Login, registrasi pemohon, edit profil, ubah kata sandi, penjaga halaman,
 * dan pengalihan otomatis berdasarkan peran:
 *   admin (TU / Kepala Unit) -> admin.html  (menu menyesuaikan jenis admin)
 *   client (Pemohon / guru)  -> client.html
 * Akun TU & Kepala Unit dibuat saat penyiapan sistem; pemohon mendaftar sendiri. */
const Auth = (() => {
  const home = (u) => (u.role === "admin" ? "admin.html" : "client.html");

  function current() {
    const s = Store.session.get();
    const u = s ? Store.users.get(s.id) : null;
    return u && u.active !== false ? u : null;
  }

  /* Hasil: { ok, user } atau { ok:false, error } */
  function login(identity, password) {
    const u = Store.users.byLogin(identity);
    if (!u || u.password !== password)
      return { ok: false, error: "Username atau password salah." };
    if (u.active === false)
      return { ok: false, error: "Akun ini dinonaktifkan. Hubungi TU." };
    Store.session.set(u);
    return { ok: true, user: u };
  }

  /* Validasi data akun pemohon. Dipakai registrasi, edit profil, dan TU saat tambah/ubah akun. */
  function validateAccount(d, { ignoreId = null, needPassword = true } = {}) {
    const errors = [];
    const name = (d.name || "").trim();
    const username = (d.username || "").trim();
    const email = (d.email || "").trim();
    const idNo = (d.idNo || "").trim();
    if (name.length < 3) errors.push("Nama lengkap minimal 3 karakter.");
    if (!/^\d+$/.test(idNo)) errors.push("NIDN hanya boleh berisi angka.");
    else if (idNo.length < U.ID_RULE.min || idNo.length > U.ID_RULE.max)
      errors.push(`NIDN harus ${U.ID_RULE.min}–${U.ID_RULE.max} angka.`);
    if (!U.UNITS.includes(d.unit)) errors.push("Pilih unit.");
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Format email tidak valid.");
    if (d.phone && !/^[0-9+\-\s]{8,16}$/.test(d.phone.trim()))
      errors.push("No. HP 8–16 digit (angka, +, -).");
    if (d.username !== undefined || ignoreId === null) {
      if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username))
        errors.push(
          "Username 3–20 karakter (huruf, angka, titik, garis bawah).",
        );
      const dupU = Store.users.byLogin(username);
      if (dupU && dupU.id !== ignoreId) errors.push("Username sudah dipakai.");
    }
    const dupE = Store.users.byLogin(email);
    if (dupE && dupE.id !== ignoreId) errors.push("Email sudah terdaftar.");
    if (needPassword || d.password) {
      if ((d.password || "").length < 6)
        errors.push("Password minimal 6 karakter.");
      if (d.password !== d.password2)
        errors.push("Konfirmasi password tidak sama.");
    }
    return errors;
  }

  function register(d) {
    const errors = validateAccount(d);
    if (errors.length) return { ok: false, errors };
    const user = Store.users.add({
      id: U.uid("u-"),
      role: "client",
      type: "guru",
      name: d.name.trim(),
      username: d.username.trim(),
      email: d.email.trim(),
      password: d.password,
      idNo: d.idNo.trim(),
      phone: (d.phone || "").trim(),
      unit: d.unit,
      active: true,
    });
    Store.session.set(user);
    return { ok: true, user };
  }

  /* Edit profil sendiri: HANYA nama lengkap, No. HP (opsional), dan foto.
   * Username, email, NIDN, dan unit ditetapkan saat pendaftaran dan tidak bisa diubah di sini. */
  function updateProfile(id, d) {
    const errors = [];
    const name = (d.name || "").trim();
    const phone = (d.phone || "").trim();
    if (name.length < 3) errors.push("Nama lengkap minimal 3 karakter.");
    if (phone && !/^[0-9+\-\s]{8,16}$/.test(phone))
      errors.push("No. HP 8–16 digit (angka, +, -).");
    const patch = { name, phone };
    if ("photo" in d) patch.photo = d.photo || "";
    if (errors.length) return { ok: false, errors };
    try {
      return { ok: true, user: Store.users.update(id, patch) };
    } catch (err) {
      return {
        ok: false,
        errors: [
          "Gagal menyimpan: penyimpanan browser penuh. Coba foto yang lebih kecil.",
        ],
      };
    }
  }

  function changePassword(id, oldPw, newPw, newPw2) {
    const me = Store.users.get(id);
    const errors = [];
    if (!me || me.password !== oldPw) errors.push("Password lama salah.");
    if ((newPw || "").length < 6)
      errors.push("Password baru minimal 6 karakter.");
    if (newPw !== newPw2) errors.push("Konfirmasi password baru tidak sama.");
    if (newPw && newPw === oldPw)
      errors.push("Password baru harus berbeda dari yang lama.");
    if (errors.length) return { ok: false, errors };
    Store.users.update(id, { password: newPw });
    return { ok: true };
  }

  function guard(allowedRoles) {
    Store.seed();
    const u = current();
    if (!u) {
      location.replace("index.html");
      return null;
    }
    if (!allowedRoles.includes(u.role)) {
      location.replace(home(u));
      return null;
    }
    return u;
  }

  function redirect(u) {
    location.replace(home(u));
  }
  function logout() {
    Store.session.clear();
    location.replace("index.html");
  }

  return {
    current,
    login,
    register,
    validateAccount,
    updateProfile,
    changePassword,
    guard,
    redirect,
    logout,
    home,
  };
})();
