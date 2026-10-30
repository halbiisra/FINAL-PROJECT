/* RUMA — client.js
 * Halaman Pemohon (guru): kalender ketersediaan & jadwal, pengajuan peminjaman aula
 * (slider kapasitas, nama kegiatan wajib, dokumen pendukung opsional maks. 2 MB), riwayat & status, pembatalan,
 * notifikasi, dan kotak email. */
(() => {
  let user = Auth.guard(["client"]);
  if (!user) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Header ---------- */
  function paintHeader() {
    $("#userName").textContent = user.name;
    $("#userRole").textContent = `Pemohon · ${user.unit || "Guru"}`;
    UI.paintAvatar($("#avatar"), user);
  }
  paintHeader();
  $("#logoutBtn").addEventListener("click", Auth.logout);
  Account.mount(user, (u) => {
    user = u;
    paintHeader();
    applyUserToForm();
  });

  /* ---------- Tab ---------- */
  const TABS = ["jadwal", "pinjam", "riwayat", "notif", "email"];
  function showTab(name) {
    if (!TABS.includes(name)) name = "jadwal";
    TABS.forEach((t) => {
      $("#tab-" + t).hidden = t !== name;
      const b = $(`[data-tab="${t}"]`);
      b.classList.toggle("active", t === name);
      if (t === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    history.replaceState(null, "", "#" + name);
    if (name === "riwayat") renderHistory();
    if (name === "notif") {
      Notify.render($("#notifList"), user);
      Notify.markRead(user);
      Notify.updateBadge($("#notifCount"), user);
    }
    if (name === "email") {
      renderMail();
      markMailRead();
    }
    if (name === "pinjam") renderAvailability();
    window.scrollTo({ top: 0 });
  }
  $$("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => showTab(b.dataset.tab)),
  );

  /* ---------- Jadwal ---------- */
  let pickedDate = U.today();
  const sched = createSchedule($("#schedRoot"), { pageSize: 4 });
  const cal = createCalendar($("#calRoot"), {
    initialDate: pickedDate,
    onSelect: (d) => {
      pickedDate = d;
      sched.setDate(d);
    },
  });
  sched.setDate(pickedDate);

  $("#pickDate").addEventListener("click", () => {
    if (pickedDate < U.today()) {
      UI.toast(
        "Tanggal tersebut sudah lewat. Pilih tanggal hari ini atau setelahnya.",
        "warn",
      );
      return;
    }
    $("#fStartDate").value = pickedDate;
    if ($("#fEndDate").value < pickedDate) $("#fEndDate").value = pickedDate;
    showTab("pinjam");
    $("#fStartDate").dispatchEvent(new Event("change"));
  });

  /* ---------- Formulir ---------- */
  const form = $("#bookForm");
  const slider = $("#fPeserta");
  let roomId = Store.rooms.all()[0].id;

  function renderRooms() {
    const rooms = Store.rooms.all();
    if (!rooms.find((r) => r.id === roomId)) roomId = rooms[0].id;
    $("#roomPick").innerHTML = rooms
      .map(
        (r) => `
      <label class="room-opt">
        <input type="radio" name="room" value="${r.id}" ${r.id === roomId ? "checked" : ""}>
        <span class="room-card"><strong>${U.esc(r.name)}</strong><small>Kapasitas ${U.fmtNum(r.capacity)} orang</small></span>
      </label>`,
      )
      .join("");
  }

  function syncSlider() {
    const room = Store.rooms.get(roomId);
    const cap = room.capacity;
    const min = Math.min(5, cap);
    slider.min = min;
    slider.max = cap;
    slider.step = cap >= 100 ? 5 : 1;
    if (Number(slider.value) > cap) slider.value = cap;
    if (Number(slider.value) < min) slider.value = min;
    const val = Number(slider.value);
    const pct = cap === min ? 100 : ((val - min) / (cap - min)) * 100;
    slider.style.setProperty("--pct", pct + "%");
    $("#pesertaOut").textContent = U.fmtNum(val) + " orang";
    $("#sliderMin").textContent = U.fmtNum(min);
    $("#sliderMid").textContent = U.fmtNum(Math.round((min + cap) / 2));
    $("#sliderMax").textContent = U.fmtNum(cap);
    const used = Math.round((val / cap) * 100);
    $("#meterFill").style.width = used + "%";
    $("#meterText").textContent =
      `${used}% dari kapasitas ${room.name} (${U.fmtNum(cap)} orang)`;
  }

  function renderAvailability() {
    const room = Store.rooms.get(roomId);
    const d = $("#fStartDate").value;
    const list = $("#availList");
    if (!d) {
      $("#availHead").textContent =
        "Pilih tanggal mulai untuk melihat jadwal ruangan.";
      list.innerHTML = "";
      return;
    }
    $("#availHead").textContent = `${room.name} · ${U.longDate(d)}`;
    const items = Store.bookings
      .all()
      .filter(
        (b) =>
          b.roomId === roomId &&
          !U.INACTIVE.includes(b.status) &&
          b.startDate <= d &&
          d <= b.endDate,
      )
      .sort((a, b) => U.toMin(a.startTime) - U.toMin(b.startTime));
    list.innerHTML = items.length
      ? items
          .map(
            (b) =>
              `<li><span>${U.timeRange(b)}</span>${U.badge(b.status)}</li>`,
          )
          .join("")
      : '<li class="free">Belum ada jadwal — ruangan kosong 🎉</li>';
  }

  /* Nama, NIDN, dan unit hanya mengikuti data akun (read-only di formulir). */
  function applyUserToForm() {
    $("#fNama").value = user.name;
    $("#fId").value = user.idNo || "-";
    $("#fUnit").value = user.unit || "-";
  }

  function resetForm() {
    form.reset();
    applyUserToForm();
    const t = U.today();
    $("#fStartDate").min = $("#fEndDate").min = t;
    $("#fStartDate").value = $("#fEndDate").value =
      pickedDate >= t ? pickedDate : t;
    $("#fStartTime").value = "09:00";
    $("#fEndTime").value = "11:00";
    renderRooms();
    slider.value = Math.min(50, Store.rooms.get(roomId).capacity);
    syncSlider();
    $("#formError").hidden = true;
    renderAvailability();
  }

  $("#roomPick").addEventListener("change", (e) => {
    if (e.target.name === "room") {
      roomId = e.target.value;
      syncSlider();
      renderAvailability();
    }
  });
  slider.addEventListener("input", syncSlider);
  $("#fStartDate").addEventListener("change", () => {
    const s = $("#fStartDate").value;
    $("#fEndDate").min = s || U.today();
    if (s && $("#fEndDate").value < s) $("#fEndDate").value = s;
    renderAvailability();
  });
  $("#resetBtn").addEventListener("click", resetForm);

  $("#termsBtn").addEventListener("click", () =>
    UI.modal({
      title: "Ketentuan peminjaman",
      body: `<ol class="terms">
      <li>Ruangan digunakan pada jam operasional 07.00 – 21.00.</li>
      <li>Jumlah peserta tidak boleh melebihi kapasitas ruangan yang ditetapkan TU.</li>
      <li>Permohonan diperiksa TU, lalu diputuskan Kepala Unit. Permohonan baru berlaku setelah berstatus <strong>Disetujui</strong>.</li>
      <li>Pengajuan yang bentrok jadwal atau melebihi kapasitas ditolak otomatis dan tidak disimpan.</li>
      <li>Pemohon menjaga kebersihan dan fasilitas ruangan.</li>
      <li>Pembatalan dapat dilakukan sendiri selama status masih <strong>Menunggu</strong> atau <strong>Diteruskan</strong>.</li>
    </ol>`,
      actions: [{ label: "Mengerti", kind: "primary" }],
    }),
  );

  function collect() {
    return {
      nama: user.name,
      idNo: user.idNo || "",
      unit: user.unit || "",
      startDate: $("#fStartDate").value,
      endDate: $("#fEndDate").value,
      startTime: $("#fStartTime").value,
      endTime: $("#fEndTime").value,
      roomId,
      peserta: Number(slider.value),
      kegiatan: $("#fKegiatan").value.trim(),
      file: $("#fDoc").files[0] || null,
      agree: $("#fAgree").checked,
    };
  }

  function showErrors(list) {
    const el = $("#formError");
    el.hidden = !list.length;
    el.innerHTML =
      list.length > 1
        ? "<ul>" + list.map((m) => `<li>${U.esc(m)}</li>`).join("") + "</ul>"
        : U.esc(list[0] || "");
    if (list.length) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = collect();
    /* Isian, file unggahan, kapasitas, dan bentrok jadwal divalidasi; bila gagal data TIDAK disimpan. */
    const errors = Flow.validate(v, user);
    showErrors(errors);
    if (errors.length) return;

    let doc = null;
    if (v.file) {
      try {
        doc = await U.readDoc(v.file);
      } catch (err) {
        showErrors(["Dokumen pendukung gagal dibaca. Coba pilih ulang file."]);
        return;
      }
    }
    let b;
    try {
      b = Flow.create(user, v, doc);
    } catch (err) {
      showErrors([
        "Gagal menyimpan: penyimpanan browser penuh. Coba tanpa dokumen atau hapus data lama.",
      ]);
      return;
    }

    const room = Store.rooms.get(b.roomId);
    $("#thanksSummary").innerHTML = [
      ["Kode", b.code],
      ["Unit", b.unit],
      ["Ruangan", room.name],
      ["Tanggal", U.rangeLabel(b.startDate, b.endDate)],
      ["Waktu", U.timeRange(b)],
      ["Peserta", U.fmtNum(b.peserta) + " orang"],
      ["Dokumen", b.doc ? b.doc.name : "—"],
    ]
      .map(([k, val]) => `<div><dt>${k}</dt><dd>${U.esc(val)}</dd></div>`)
      .join("");
    $("#mailBtn").href = Mailer.mailtoFor(b, "diterima");
    $("#formArea").hidden = true;
    $("#thanks").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    refreshAll();
  });

  $("#againBtn").addEventListener("click", () => {
    $("#thanks").hidden = true;
    $("#formArea").hidden = false;
    resetForm();
  });
  $("#toHistory").addEventListener("click", () => {
    $("#thanks").hidden = true;
    $("#formArea").hidden = false;
    resetForm();
    showTab("riwayat");
  });

  /* ---------- Riwayat ---------- */
  const mine = () =>
    Store.bookings
      .all()
      .filter((b) => b.userId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt);

  function renderHistory() {
    const list = mine();
    const pending = list.filter((b) => U.PENDING.includes(b.status)).length;
    const c = $("#histCount");
    c.hidden = !pending;
    c.textContent = pending;
    $("#histList").innerHTML = list.length
      ? list
          .map((b) => {
            const room = Store.rooms.get(b.roomId);
            const mailKind = ["disetujui", "ditolak", "dibatalkan"].includes(
              b.status,
            )
              ? b.status
              : "diterima";
            return `<article class="card pad hist-item">
        <div class="hist-top"><strong>${U.esc(b.kegiatan || "Peminjaman " + (room ? room.name : ""))}</strong>${U.badge(b.status)}</div>
        <dl class="hist-meta">
          <div><dt>Kode</dt><dd>${U.esc(b.code)}</dd></div>
          <div><dt>Ruangan</dt><dd>${U.esc(room ? room.name : "-")}</dd></div>
          <div><dt>Tanggal</dt><dd>${U.rangeLabel(b.startDate, b.endDate)}</dd></div>
          <div><dt>Waktu</dt><dd>${U.timeRange(b)}</dd></div>
          <div><dt>Peserta</dt><dd>${U.fmtNum(b.peserta)} orang</dd></div>
          ${b.decidedBy ? `<div><dt>Diputuskan</dt><dd>${U.esc(b.decidedBy)}<small class="sub">${U.wib(b.decidedAt)}</small></dd></div>` : ""}
        </dl>
        ${b.status === "ditolak" ? `<p class="form-error"><strong>Alasan penolakan:</strong> ${U.esc(b.alasan)}</p>` : ""}
        ${b.status === "diteruskan" ? '<p class="admin-note">TU sudah memeriksa permohonanmu dan meneruskannya ke Kepala Unit.</p>' : ""}
        ${b.status === "dibatalkan" ? '<p class="admin-note">Permohonan dibatalkan. Jadwal kembali tersedia di kalender.</p>' : ""}
        <div class="hist-actions">
          <a class="btn ghost sm" href="${Mailer.mailtoFor(b, mailKind)}">Kirim ke email</a>
          ${U.PENDING.includes(b.status) ? `<button type="button" class="btn danger sm" data-cancel="${b.id}">Batalkan</button>` : ""}
        </div>
      </article>`;
          })
          .join("")
      : `<div class="empty card pad"><strong>Belum ada peminjaman</strong><span>Ajukan lewat tab “Ajukan Peminjaman”.</span></div>`;
  }

  /* Batalkan: hanya status Menunggu / Diteruskan. Selain itu tampil pesan tidak dapat dibatalkan. */
  $("#histList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cancel]");
    if (!btn) return;
    const b = Store.bookings.get(btn.dataset.cancel);
    if (!b || !U.PENDING.includes(b.status)) {
      UI.toast("Permohonan sudah diproses dan tidak dapat dibatalkan.", "warn");
      refreshAll();
      return;
    }
    if (
      await UI.confirm(
        `Batalkan permohonan ${b.code}? Jadwal akan kembali tersedia.`,
        { title: "Batalkan peminjaman", okLabel: "Ya, batalkan", danger: true },
      )
    ) {
      const res = Flow.cancel(b.id, user);
      UI.toast(
        res.ok
          ? "Permohonan dibatalkan. Notifikasi dan email terkirim."
          : res.error,
        res.ok ? "ok" : "warn",
      );
      refreshAll();
    }
  });

  /* ---------- Kotak email ---------- */
  const myMails = () =>
    Store.mails
      .all()
      .filter((m) => m.to.toLowerCase() === user.email.toLowerCase())
      .sort((a, b) => b.createdAt - a.createdAt);

  function updateMailCount() {
    const n = myMails().filter((m) => !m.read).length;
    const c = $("#mailCount");
    c.hidden = !n;
    c.textContent = n;
  }
  function markMailRead() {
    myMails()
      .filter((m) => !m.read)
      .forEach((m) => Store.mails.update(m.id, { read: true }));
    updateMailCount();
  }
  function renderMail() {
    $("#mailAddr").textContent = user.email;
    const list = myMails();
    $("#mailList").innerHTML = list.length
      ? list
          .map(
            (m) => `
      <details class="card mail ${m.read ? "" : "unread"}">
        <summary><span class="mail-sub">${U.esc(m.subject)}</span><time>${U.timeAgo(m.createdAt)}</time></summary>
        <pre>${U.esc(m.body)}</pre>
      </details>`,
          )
          .join("")
      : '<div class="empty card pad"><strong>Kotak email kosong</strong><span>Notifikasi status peminjaman akan muncul di sini.</span></div>';
  }

  /* ---------- Sinkron dengan TU / Kepala Unit ---------- */
  function refreshAll() {
    cal.refresh();
    sched.refresh();
    const sel = slider.value;
    renderRooms();
    slider.value = sel;
    syncSlider();
    renderAvailability();
    renderHistory();
    if (!$("#tab-notif").hidden) {
      Notify.render($("#notifList"), user);
      Notify.markRead(user);
    }
    Notify.updateBadge($("#notifCount"), user);
    if (!$("#tab-email").hidden) {
      renderMail();
      markMailRead();
    } else updateMailCount();
  }

  Notify.watch(user, refreshAll);

  /* ---------- Mulai ---------- */
  resetForm();
  renderHistory();
  updateMailCount();
  Notify.updateBadge($("#notifCount"), user);
  showTab(location.hash.slice(1));
})();
