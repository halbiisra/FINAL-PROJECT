/* RUMA — mailer.js
 * Simulasi email notifikasi ke pemohon. Isi email disimpan di "Kotak Email" pemohon
 * (data bersama), dan tombol "Kirim ke email" membuka aplikasi email lewat mailto:.
 * Email otomatis dikirim saat status menjadi Disetujui, Ditolak, atau Dibatalkan.
 * Catatan: web statis tidak bisa mengirim email sungguhan; untuk itu perlu server. */
const Mailer = (() => {
  function summary(b) {
    const room = Store.rooms.get(b.roomId);
    return [
      `Kode      : ${b.code}`,
      `Pemohon   : ${b.nama} (${b.idNo})`,
      b.unit ? `Unit      : ${b.unit}` : null,
      `Ruangan   : ${room ? room.name : "-"}`,
      `Tanggal   : ${U.rangeLabel(b.startDate, b.endDate)}`,
      `Waktu     : ${U.timeRange(b)}`,
      `Peserta   : ${b.peserta} orang`,
      b.kegiatan ? `Kegiatan  : ${b.kegiatan}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function compose(b, kind) {
    const hi = `Halo ${b.nama},\n\n`;
    const bye = "\n\nSalam,\nTata Usaha Sekolah Tunas Dharma";
    const by = b.decidedBy
      ? `\nDiputuskan oleh : ${b.decidedBy}${b.decidedAt ? " pada " + U.wib(b.decidedAt) : ""}`
      : "";
    const map = {
      diterima: [
        `[RUMA] Permohonan diterima (${b.code})`,
        `${hi}Permohonan peminjaman aula sudah kami terima dan diteruskan ke TU. Status saat ini: MENUNGGU.\n\n${summary(b)}${bye}`,
      ],
      disetujui: [
        `[RUMA] Peminjaman DISETUJUI (${b.code})`,
        `${hi}Kabar baik! Peminjaman aula telah DISETUJUI.\n\n${summary(b)}${by}${bye}`,
      ],
      ditolak: [
        `[RUMA] Peminjaman DITOLAK (${b.code})`,
        `${hi}Mohon maaf, peminjaman aula belum dapat disetujui.\n\n${summary(b)}${by}\nAlasan penolakan: ${b.alasan || "-"}${bye}`,
      ],
      dibatalkan: [
        `[RUMA] Peminjaman DIBATALKAN (${b.code})`,
        `${hi}Permohonan peminjaman aula telah DIBATALKAN sesuai permintaanmu. Jadwal kembali tersedia di kalender.\n\n${summary(b)}${bye}`,
      ],
    };
    const [subject, body] = map[kind] || map.diterima;
    return { subject, body };
  }

  function send(b, kind) {
    const user = Store.users.get(b.userId);
    if (!user) return null;
    const m = compose(b, kind);
    return Store.mails.add({
      id: U.uid("m-"),
      to: user.email,
      subject: m.subject,
      body: m.body,
      createdAt: Date.now(),
      bookingId: b.id,
      kind,
      read: false,
    });
  }

  function mailtoFor(b, kind) {
    const user = Store.users.get(b.userId);
    const m = compose(b, kind);
    return U.mailto(user ? user.email : "", m.subject, m.body);
  }

  return { summary, compose, send, mailtoFor };
})();
