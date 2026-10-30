/* RUMA — flow.js
 * Alur status permohonan (sesuai activity diagram):
 *   Pemohon ajukan -> Menunggu -> [TU] Diteruskan -> [Kepala Unit] Disetujui | Ditolak
 *   Pemohon dapat membatalkan selama status Menunggu / Diteruskan -> Dibatalkan.
 * Semua fungsi membaca ulang data terbaru dari Store sebelum mengubah status,
 * dan mengembalikan { ok, ... } atau { ok:false, error }. */
const Flow = (() => {
  const label = (b) => `${b.code} (${b.nama})`;

  /* Validasi pengajuan: isian formulir, file unggahan, kapasitas, dan bentrok jadwal. */
  function validate(v, user) {
    const e = [];
    /* Nama, NIDN, dan unit selalu mengikuti data akun (tidak bisa diubah saat booking). */
    if (user) {
      v.nama = user.name || v.nama;
      v.idNo = user.idNo || v.idNo;
      if (user.unit && U.UNITS.includes(user.unit)) v.unit = user.unit;
    }
    const room = Store.rooms.get(v.roomId);
    if (v.nama.length < 3) e.push("Nama lengkap minimal 3 karakter.");
    if (!/^\d+$/.test(v.idNo)) e.push("NIDN hanya boleh berisi angka.");
    else if (v.idNo.length < U.ID_RULE.min || v.idNo.length > U.ID_RULE.max)
      e.push(`NIDN harus ${U.ID_RULE.min}–${U.ID_RULE.max} angka.`);
    if (!U.UNITS.includes(v.unit)) e.push("Pilih unit.");
    if (!v.startDate) e.push("Tanggal mulai wajib diisi.");
    else if (v.startDate < U.today())
      e.push("Tanggal mulai tidak boleh sebelum hari ini.");
    if (!v.endDate) e.push("Tanggal selesai wajib diisi.");
    else if (v.startDate && v.endDate < v.startDate)
      e.push("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    if (!v.startTime || !v.endTime)
      e.push("Jam mulai dan jam selesai wajib diisi.");
    else {
      if (U.toMin(v.endTime) <= U.toMin(v.startTime))
        e.push("Jam selesai harus setelah jam mulai.");
      if (
        U.toMin(v.startTime) < U.toMin(U.OPEN_HOUR) ||
        U.toMin(v.endTime) > U.toMin(U.CLOSE_HOUR)
      )
        e.push("Jam peminjaman harus dalam 07.00 – 21.00.");
    }
    if (!v.kegiatan || !v.kegiatan.trim()) e.push("Nama kegiatan wajib diisi.");
    else if (v.kegiatan.trim().length < 3)
      e.push("Nama kegiatan minimal 3 karakter.");
    if (v.file) {
      const ext = (v.file.name.split(".").pop() || "").toLowerCase();
      if (!U.DOC_RULE.exts.includes(ext))
        e.push(
          `Dokumen pendukung harus berformat ${U.DOC_RULE.exts.join(", ").toUpperCase()}.`,
        );
      if (v.file.size > U.DOC_RULE.maxBytes)
        e.push(
          `Ukuran dokumen pendukung maksimal ${U.fmtSize(U.DOC_RULE.maxBytes)}.`,
        );
    }
    if (!room) e.push("Pilih ruangan.");
    else if (v.peserta > room.capacity)
      e.push(
        `Jumlah peserta melebihi kapasitas ${room.name} (${U.fmtNum(room.capacity)} orang).`,
      );
    if (!v.agree) e.push("Centang persetujuan ketentuan peminjaman.");
    /* Bentrok jadwal → ditolak otomatis & tidak disimpan */
    if (!e.length) {
      const c = U.findConflict(v, Store.bookings.all(), ["disetujui"]);
      if (c)
        e.push(
          `Jadwal bentrok dengan peminjaman yang sudah disetujui: ${room.name}, ${U.rangeLabel(c.startDate, c.endDate)}, ${U.timeRange(c)}. Pilih jam atau ruangan lain.`,
        );
    }
    return e;
  }

  /* Simpan permohonan baru (status Menunggu) lalu beri tahu semua TU. */
  function create(user, v, doc) {
    const b = Store.bookings.add({
      id: U.uid("b-"),
      code: U.bookingCode(),
      userId: user.id,
      nama: user.name,
      idNo: user.idNo || v.idNo,
      unit: user.unit && U.UNITS.includes(user.unit) ? user.unit : v.unit,
      phone: user.phone || "",
      startDate: v.startDate,
      endDate: v.endDate,
      startTime: v.startTime,
      endTime: v.endTime,
      roomId: v.roomId,
      peserta: v.peserta,
      kegiatan: v.kegiatan.trim(),
      doc: doc || null,
      status: "menunggu",
      note: "",
      createdAt: Date.now(),
      tuNote: "",
      seatsPrepared: null,
      forwardedAt: null,
      forwardedBy: "",
      decidedAt: null,
      decidedBy: "",
      alasan: "",
      cancelledAt: null,
    });
    Notify.toAdmins(
      "tu",
      `Pengajuan baru ${label(b)} — ${U.rangeLabel(b.startDate, b.endDate)}.`,
      b.id,
    );
    return b;
  }

  /* TU: catat kesiapan aula & jumlah kursi, lalu teruskan ke Kepala Unit. */
  function forward(id, tu, { tuNote, seats }) {
    const b = Store.bookings.get(id);
    if (!b) return { ok: false, error: "Permohonan tidak ditemukan." };
    if (b.status !== "menunggu")
      return {
        ok: false,
        error: `Permohonan sudah berstatus ${U.STATUS[b.status]} dan tidak bisa diteruskan.`,
      };
    const n = Number(seats);
    if (!tuNote || !tuNote.trim())
      return { ok: false, error: "Catatan kesiapan aula wajib diisi." };
    if (!Number.isInteger(n) || n < 1)
      return {
        ok: false,
        error: "Jumlah kursi yang disiapkan harus berupa angka ≥ 1.",
      };
    const u = Store.bookings.update(id, {
      status: "diteruskan",
      tuNote: tuNote.trim(),
      seatsPrepared: n,
      forwardedAt: Date.now(),
      forwardedBy: tu.name,
    });
    Notify.toAdmins(
      "kepala",
      `Permohonan ${label(u)} diteruskan oleh TU — menunggu keputusan Anda.`,
      u.id,
    );
    return { ok: true, booking: u };
  }

  function notifyDecision(b, kind) {
    Mailer.send(b, kind);
    const t = {
      disetujui: "DISETUJUI",
      ditolak: "DITOLAK",
      dibatalkan: "DIBATALKAN",
    }[kind];
    Notify.push(
      b.userId,
      `Peminjaman ${b.code} kini ${t}.${kind === "ditolak" ? " Alasan: " + b.alasan : ""}`,
      b.id,
    );
  }

  /* Kepala Unit: setujui — periksa ulang bentrok & kapasitas, catat pemberi & waktu keputusan. */
  function approve(id, kepala) {
    const b = Store.bookings.get(id);
    if (!b) return { ok: false, error: "Permohonan tidak ditemukan." };
    if (b.status !== "diteruskan")
      return {
        ok: false,
        error: `Permohonan berstatus ${U.STATUS[b.status]}; hanya yang Diteruskan yang bisa diputuskan.`,
      };
    const room = Store.rooms.get(b.roomId);
    if (room && b.peserta > room.capacity)
      return {
        ok: false,
        error: `Tidak dapat disetujui: ${U.fmtNum(b.peserta)} peserta melebihi kapasitas ${room.name} (${U.fmtNum(room.capacity)}).`,
      };
    const c = U.findConflict(b, Store.bookings.all(), ["disetujui"], b.id);
    if (c)
      return {
        ok: false,
        error: `Tidak dapat disetujui: jadwal masih bentrok dengan ${c.code} (${U.rangeLabel(c.startDate, c.endDate)}, ${U.timeRange(c)}).`,
      };
    const u = Store.bookings.update(id, {
      status: "disetujui",
      decidedAt: Date.now(),
      decidedBy: kepala.name,
      alasan: "",
    });
    notifyDecision(u, "disetujui");
    return { ok: true, booking: u };
  }

  /* Kepala Unit: tolak — alasan wajib. */
  function reject(id, kepala, alasan) {
    const b = Store.bookings.get(id);
    if (!b) return { ok: false, error: "Permohonan tidak ditemukan." };
    if (b.status !== "diteruskan")
      return {
        ok: false,
        error: `Permohonan berstatus ${U.STATUS[b.status]}; hanya yang Diteruskan yang bisa diputuskan.`,
      };
    if (!alasan || !alasan.trim())
      return { ok: false, error: "Alasan penolakan wajib diisi." };
    const u = Store.bookings.update(id, {
      status: "ditolak",
      alasan: alasan.trim(),
      decidedAt: Date.now(),
      decidedBy: kepala.name,
    });
    notifyDecision(u, "ditolak");
    return { ok: true, booking: u };
  }

  /* Pemohon: batalkan selama Menunggu / Diteruskan. Jadwal otomatis kembali tersedia. */
  function cancel(id, user) {
    const b = Store.bookings.get(id);
    if (!b || b.userId !== user.id)
      return { ok: false, error: "Permohonan tidak ditemukan." };
    if (!U.PENDING.includes(b.status))
      return {
        ok: false,
        error: `Permohonan berstatus ${U.STATUS[b.status]} dan tidak dapat dibatalkan.`,
      };
    const u = Store.bookings.update(id, {
      status: "dibatalkan",
      cancelledAt: Date.now(),
    });
    Notify.toAdmins(
      "tu",
      `Permohonan ${label(u)} dibatalkan oleh pemohon.`,
      u.id,
    );
    Notify.toAdmins(
      "kepala",
      `Permohonan ${label(u)} dibatalkan oleh pemohon.`,
      u.id,
    );
    notifyDecision(u, "dibatalkan");
    return { ok: true, booking: u };
  }

  return { validate, create, forward, approve, reject, cancel };
})();
