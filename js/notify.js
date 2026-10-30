/* RUMA — notify.js
 * Notifikasi dalam aplikasi untuk semua peran + panel "Notifikasi". */
const Notify = (() => {
  function push(userId, text, bookingId) {
    return Store.notifs.add({
      id: U.uid("n-"),
      userId,
      text,
      bookingId: bookingId || null,
      createdAt: Date.now(),
      read: false,
    });
  }
  /* Kirim ke semua admin aktif dengan jenis tertentu: 'tu' atau 'kepala' */
  function toAdmins(type, text, bookingId) {
    Store.users.admins(type).forEach((u) => push(u.id, text, bookingId));
  }
  const mine = (user) =>
    Store.notifs
      .all()
      .filter((n) => n.userId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  const unread = (user) => mine(user).filter((n) => !n.read).length;
  const markRead = (user) =>
    mine(user)
      .filter((n) => !n.read)
      .forEach((n) => Store.notifs.update(n.id, { read: true }));

  function render(root, user) {
    const list = mine(user);
    root.innerHTML = list.length
      ? list
          .map(
            (n) => `
      <article class="card notif ${n.read ? "" : "unread"}">
        <p>${U.esc(n.text)}</p><time>${U.timeAgo(n.createdAt)}</time>
      </article>`,
          )
          .join("")
      : '<div class="empty card pad"><strong>Belum ada notifikasi</strong><span>Pemberitahuan terkait permohonan akan muncul di sini.</span></div>';
  }

  function updateBadge(el, user) {
    const n = unread(user);
    el.hidden = !n;
    el.textContent = n;
  }

  /* Tampilkan toast saat ada notifikasi baru untuk pengguna ini (dari tab lain). */
  function watch(user, onAny) {
    let known = new Set(mine(user).map((n) => n.id));
    Store.onChange((key) => {
      if (key === "ruma.notifs") {
        mine(user)
          .filter((n) => !known.has(n.id))
          .reverse()
          .forEach((n) => UI.toast(n.text, "info", 6000));
        known = new Set(mine(user).map((n) => n.id));
      }
      if (onAny) onAny(key);
    });
  }

  return { push, toAdmins, mine, unread, markRead, render, updateBadge, watch };
})();
