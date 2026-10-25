/* RUMA — mailer.js
 * Simulasi email notifikasi. Isi email disimpan di "Kotak Email" pengguna
 * (data bersama), dan tombol "Kirim ke email" membuka aplikasi email lewat mailto:.
 * Catatan: web statis tidak bisa mengirim email sungguhan; untuk itu perlu server. */
const Mailer = (() => {
  function summary(b) {
    const room = Store.rooms.get(b.roomId);
    return [
      `Kode      : ${b.code}`,
      `Peminjam  : ${b.nama} (${b.idNo})`,
      `Ruangan   : ${room ? room.name : '-'}`,
      `Tanggal   : ${U.rangeLabel(b.startDate, b.endDate)}`,
      `Waktu     : ${U.timeRange(b)}`,
      `Peserta   : ${b.peserta} orang`,
      b.kegiatan ? `Kegiatan  : ${b.kegiatan}` : null,
    ].filter(Boolean).join('\n');
  }

  function compose(b, kind) {
    const hi = `Halo ${b.nama},\n\n`;
    const bye = '\n\nSalam,\nTim RUMA — Ruang Untuk Meeting dan Acara';
    const note = b.note ? `\n\nCatatan admin: ${b.note}` : '';
    const map = {
      diterima: [`[RUMA] Permohonan diterima (${b.code})`, `${hi}Permohonan peminjamanmu sudah kami terima. Status saat ini: MENUNGGU. Mohon periksa email secara berkala.\n\n${summary(b)}${bye}`],
      disetujui: [`[RUMA] Peminjaman DISETUJUI (${b.code})`, `${hi}Kabar baik! Peminjaman ruangmu telah DISETUJUI.\n\n${summary(b)}${note}${bye}`],
      ditolak: [`[RUMA] Peminjaman DITOLAK (${b.code})`, `${hi}Mohon maaf, peminjaman ruangmu belum dapat kami setujui.\n\n${summary(b)}${note}${bye}`],
      menunggu: [`[RUMA] Status kembali MENUNGGU (${b.code})`, `${hi}Status peminjamanmu dikembalikan ke MENUNGGU untuk ditinjau ulang.\n\n${summary(b)}${note}${bye}`],
    };
    const [subject, body] = map[kind] || map.diterima;
    return { subject, body };
  }

  function send(b, kind) {
    const user = Store.users.get(b.userId);
    if (!user) return null;
    const m = compose(b, kind);
    return Store.mails.add({ id: U.uid('m-'), to: user.email, subject: m.subject, body: m.body, createdAt: Date.now(), bookingId: b.id, kind, read: false });
  }

  function mailtoFor(b, kind) {
    const user = Store.users.get(b.userId);
    const m = compose(b, kind);
    return U.mailto(user ? user.email : '', m.subject, m.body);
  }

  return { summary, compose, send, mailtoFor };
})();
