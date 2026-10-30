/* RUMA — admin.js
 * Halaman admin untuk dua jenis admin dengan akses berbeda:
 *   Admin TU           : lihat permohonan & kalender, periksa dokumen, catat kesiapan aula &
 *                        jumlah kursi, teruskan ke Kepala Unit, ubah data aula, kelola akun.
 *   Admin Kepala Unit  : lihat permohonan yang diteruskan + catatan TU, buka dokumen,
 *                        setujui / tolak (alasan wajib), lihat rekap (periode & unit).
 * Fitur umum: kalender, notifikasi, edit profil, ubah kata sandi. */
(() => {
  let admin = Auth.guard(["admin"]);
  if (!admin) return;
  const ROLE = admin.type; // 'tu' | 'kepala'
  const isTU = ROLE === "tu";
  const isKepala = ROLE === "kepala";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function paintHeader() {
    $("#userName").textContent = admin.name;
    UI.paintAvatar($("#avatar"), admin);
    $("#roleTag").textContent = isTU ? "Admin TU" : "Admin Kepala Unit";
    $("#userRole").textContent = U.typeLabel(admin.type);
  }
  paintHeader();
  $("#logoutBtn").addEventListener("click", Auth.logout);
  Account.mount(admin, (u) => {
    admin = u;
    paintHeader();
  });

  /* ---------- Akses menu menurut jenis admin ---------- */
  $$("[data-tab]").forEach((b) => {
    if (!b.dataset.roles.split(" ").includes(ROLE)) b.hidden = true;
  });
  const TABS = $$("[data-tab]")
    .filter((b) => !b.hidden)
    .map((b) => b.dataset.tab);
  $("#permLabel").textContent = isTU ? "Permohonan" : "Persetujuan";
  $("#permTitle").textContent = isTU
    ? "Permohonan peminjaman"
    : "Persetujuan permohonan";
  $("#permSub").textContent = isTU
    ? "Periksa dokumen, catat kesiapan aula & jumlah kursi, lalu teruskan ke Kepala Unit."
    : "Tinjau permohonan yang diteruskan TU beserta catatannya, lalu setujui atau tolak.";

  function showTab(name) {
    if (!TABS.includes(name)) name = "ringkasan";
    $$("main > section").forEach((sec) => {
      sec.hidden = sec.id !== "tab-" + name;
    });
    $$("[data-tab]").forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    history.replaceState(null, "", "#" + name);
    if (name === "notif") {
      Notify.render($("#notifList"), admin);
      Notify.markRead(admin);
    }
    renderAll();
    window.scrollTo({ top: 0 });
  }
  $$("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => showTab(b.dataset.tab)),
  );
  const currentTab = () =>
    TABS.find((t) => !$("#tab-" + t).hidden) || "ringkasan";

  const roomName = (id) => {
    const r = Store.rooms.get(id);
    return r ? r.name : "-";
  };
  /* TU melihat semua permohonan; Kepala Unit hanya yang sudah diteruskan TU. */
  const allBookings = () => Store.bookings.all();
  const visible = () =>
    isTU ? allBookings() : allBookings().filter((b) => b.forwardedAt);

  /* ---------- Detail permohonan (aksi sesuai peran) ---------- */
  function detailModal(id) {
    const b = Store.bookings.get(id);
    if (!b) return;
    const room = Store.rooms.get(b.roomId);
    const owner = Store.users.get(b.userId);
    const canForward = isTU && b.status === "menunggu";
    const canDecide = isKepala && b.status === "diteruskan";
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="detail-top"><strong>${U.esc(b.kegiatan || "Peminjaman " + roomName(b.roomId))}</strong>${U.badge(b.status)}</div>
      <dl class="detail">
        <div><dt>Kode</dt><dd>${U.esc(b.code)}</dd></div>
        <div><dt>Pemohon</dt><dd>${U.esc(b.nama)}</dd></div>
        <div><dt>NIDN</dt><dd>${U.esc(b.idNo)}</dd></div>
        <div><dt>Unit</dt><dd>${U.esc(b.unit || "-")}</dd></div>
        <div><dt>Email</dt><dd>${U.esc(owner ? owner.email : "-")}</dd></div>
        ${b.phone ? `<div><dt>No. HP</dt><dd>${U.esc(b.phone)}</dd></div>` : ""}
        <div><dt>Ruangan</dt><dd>${U.esc(roomName(b.roomId))}</dd></div>
        <div><dt>Tanggal</dt><dd>${U.rangeLabel(b.startDate, b.endDate)}</dd></div>
        <div><dt>Waktu</dt><dd>${U.timeRange(b)}</dd></div>
        <div><dt>Peserta</dt><dd>${U.fmtNum(b.peserta)} orang${room && b.peserta > room.capacity ? ' <span class="badge ditolak">melebihi kapasitas</span>' : ""}</dd></div>
        <div><dt>Diajukan</dt><dd>${U.timeAgo(b.createdAt)}</dd></div>
        <div><dt>Dokumen pendukung</dt><dd>${b.doc ? `${U.esc(b.doc.name)} <small class="sub">${U.fmtSize(b.doc.size)}</small> <button type="button" class="btn ghost sm" data-opendoc>${isTU ? "Periksa dokumen" : "Buka dokumen"}</button>` : '<span class="muted-sm">Tidak ada</span>'}</dd></div>
      </dl>
      ${b.forwardedAt && !canForward ? `<div class="admin-note"><strong>Catatan TU</strong> (${U.esc(b.forwardedBy)}, ${U.wib(b.forwardedAt)}):<br>${U.esc(b.tuNote)}<br><em>Kursi disiapkan: ${U.fmtNum(b.seatsPrepared)}</em></div>` : ""}
      ${b.decidedAt ? `<div class="admin-note"><strong>${U.STATUS[b.status]}</strong> oleh ${U.esc(b.decidedBy)} — ${U.wib(b.decidedAt)}${b.status === "ditolak" ? `<br>Alasan: ${U.esc(b.alasan)}` : ""}</div>` : ""}
      ${b.status === "dibatalkan" ? `<div class="admin-note">Dibatalkan oleh pemohon${b.cancelledAt ? " — " + U.wib(b.cancelledAt) : ""}.</div>` : ""}
      ${
        canForward
          ? `
        <div class="field"><label for="dTuNote">Catatan kesiapan aula <span class="req-tag">wajib</span></label>
          <textarea id="dTuNote" rows="3" maxlength="240" placeholder="Contoh: Aula kosong & bersih, proyektor dan sound system siap."></textarea></div>
        <div class="field"><label for="dSeats">Jumlah kursi yang disiapkan <span class="req-tag">wajib</span></label>
          <input id="dSeats" type="number" min="1" step="1" value="${room ? room.seats || room.capacity : b.peserta}"></div>`
          : ""
      }
      ${
        canDecide
          ? `
        <div class="field"><label for="dAlasan">Alasan penolakan <span class="opt-tag">wajib bila menolak</span></label>
          <textarea id="dAlasan" rows="3" maxlength="240"></textarea></div>`
          : ""
      }
      <div class="form-error" id="dErr" role="alert" hidden></div>`;
    const err = (msg) => {
      const el = body.querySelector("#dErr");
      el.hidden = false;
      el.textContent = msg;
    };

    const od = body.querySelector("[data-opendoc]");
    if (od) od.addEventListener("click", () => U.openDoc(b.doc));

    const actions = [{ label: "Tutup", kind: "ghost" }];
    if (canForward) {
      actions.push({
        label: "Teruskan ke Kepala Unit",
        kind: "primary",
        onClick: (close) => {
          const res = Flow.forward(b.id, admin, {
            tuNote: body.querySelector("#dTuNote").value,
            seats: body.querySelector("#dSeats").value,
          });
          if (!res.ok) {
            err(res.error);
            return;
          }
          close();
          UI.toast(`${b.code} diteruskan ke Kepala Unit.`, "ok");
          renderAll();
        },
      });
    }
    if (canDecide) {
      actions.push({
        label: "Tolak",
        kind: "warn",
        onClick: (close) => {
          const res = Flow.reject(
            b.id,
            admin,
            body.querySelector("#dAlasan").value,
          );
          if (!res.ok) {
            err(res.error);
            return;
          }
          close();
          UI.toast(
            `${b.code} ditolak. Notifikasi dan email terkirim ke pemohon.`,
            "info",
          );
          renderAll();
        },
      });
      actions.push({
        label: "Setujui",
        kind: "primary",
        onClick: (close) => {
          const res = Flow.approve(b.id, admin);
          if (!res.ok) {
            err(res.error);
            return;
          }
          close();
          UI.toast(
            `${b.code} disetujui. Notifikasi dan email terkirim ke pemohon.`,
            "ok",
          );
          renderAll();
        },
      });
    }
    UI.modal({ title: "Detail permohonan", body, actions, wide: true });
  }

  /* ---------- Ringkasan ---------- */
  function renderSummary() {
    const bs = visible();
    const t = U.today();
    const count = (s) => bs.filter((b) => b.status === s).length;
    const upcomingOk = bs.filter(
      (b) => b.status === "disetujui" && b.endDate >= t,
    ).length;
    const tiles = isTU
      ? [
          ["menunggu", count("menunggu"), "Perlu diperiksa"],
          ["diteruskan", count("diteruskan"), "Menunggu Kepala Unit"],
          ["disetujui", upcomingOk, "Disetujui (mendatang)"],
          [
            "user",
            Store.users
              .all()
              .filter((u) => u.role === "client" && u.active !== false).length,
            "Pemohon aktif",
          ],
        ]
      : [
          ["diteruskan", count("diteruskan"), "Menunggu keputusan"],
          ["disetujui", upcomingOk, "Disetujui (mendatang)"],
          ["ditolak", count("ditolak"), "Ditolak"],
          ["dibatalkan", count("dibatalkan"), "Dibatalkan pemohon"],
        ];
    $("#stats").innerHTML = tiles
      .map(
        ([k, n, label]) =>
          `<div class="stat ${k}"><strong>${U.fmtNum(n)}</strong><span>${label}</span></div>`,
      )
      .join("");
    $("#sumSub").textContent = isTU
      ? "Pantau pengajuan baru dari pemohon, periksa, lalu teruskan ke Kepala Unit."
      : "Pantau permohonan yang diteruskan TU dan menunggu keputusan Anda.";
    $("#quickTitle").textContent = isTU
      ? "Perlu diperiksa"
      : "Menunggu keputusan";

    const need = bs
      .filter((b) => b.status === (isTU ? "menunggu" : "diteruskan"))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 5);
    $("#quickList").innerHTML = need.length
      ? need
          .map(
            (b) => `
      <div class="qrow">
        <div><strong>${U.esc(b.nama)}</strong><small>${roomName(b.roomId)} · ${U.rangeLabel(b.startDate, b.endDate)} · ${U.timeRange(b)}</small></div>
        <div class="qact"><button class="btn primary sm" data-detail="${b.id}">${isTU ? "Periksa" : "Tinjau"}</button></div>
      </div>`,
          )
          .join("")
      : '<div class="empty"><strong>Semua beres 🎉</strong><span>Tidak ada permohonan yang menunggu.</span></div>';

    const up = bs
      .filter((b) => b.status === "disetujui" && b.endDate >= t)
      .sort((a, b) =>
        (a.startDate + a.startTime).localeCompare(b.startDate + b.startTime),
      )
      .slice(0, 5);
    $("#upcoming").innerHTML = up.length
      ? up
          .map(
            (b) => `
      <div class="qrow">
        <div><strong>${U.esc(b.kegiatan || b.nama)}</strong><small>${roomName(b.roomId)} · ${U.rangeLabel(b.startDate, b.endDate)} · ${U.timeRange(b)}</small></div>
        <span class="muted-sm">${U.fmtNum(b.peserta)} org</span>
      </div>`,
          )
          .join("")
      : '<div class="empty"><strong>Belum ada jadwal</strong><span>Jadwal yang disetujui tampil di sini.</span></div>';
  }

  /* ---------- Permohonan / Persetujuan ---------- */
  const FILTERS = isTU
    ? [
        ["semua", "Semua"],
        ["menunggu", "Menunggu"],
        ["diteruskan", "Diteruskan"],
        ["disetujui", "Disetujui"],
        ["ditolak", "Ditolak"],
        ["dibatalkan", "Dibatalkan"],
      ]
    : [
        ["diteruskan", "Perlu keputusan"],
        ["disetujui", "Disetujui"],
        ["ditolak", "Ditolak"],
        ["dibatalkan", "Dibatalkan"],
        ["semua", "Semua"],
      ];
  let filter = FILTERS[0][0];
  let query = "";
  $("#filterChips").innerHTML = FILTERS.map(
    ([k, l], i) =>
      `<button type="button" class="chip${i === 0 ? " active" : ""}" data-filter="${k}">${l}</button>`,
  ).join("");

  function renderRequests() {
    const q = query.trim().toLowerCase();
    const list = visible()
      .filter((b) => filter === "semua" || b.status === filter)
      .filter(
        (b) =>
          !q ||
          [b.nama, b.code, b.kegiatan, b.idNo, b.unit]
            .join(" ")
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    $("#reqBody").innerHTML = list.length
      ? list
          .map((b) => {
            const room = Store.rooms.get(b.roomId);
            const over = room && b.peserta > room.capacity;
            const act =
              isTU && b.status === "menunggu"
                ? "Periksa"
                : isKepala && b.status === "diteruskan"
                  ? "Tinjau"
                  : "Detail";
            const primary = act !== "Detail";
            return `<tr>
        <td data-label="Kode"><code>${U.esc(b.code)}</code></td>
        <td data-label="Pemohon">${U.esc(b.nama)}<small class="sub">${U.esc(b.unit || "")}${b.kegiatan ? " · " + U.esc(b.kegiatan) : ""}</small></td>
        <td data-label="Tanggal">${U.rangeLabel(b.startDate, b.endDate)}</td>
        <td data-label="Waktu">${U.timeRange(b)}</td>
        <td data-label="Ruangan">${U.esc(room ? room.name : "-")}<small class="sub ${over ? "bad-text" : ""}">${U.fmtNum(b.peserta)} peserta${over ? " · melebihi kapasitas" : ""}</small></td>
        <td data-label="Status">${U.badge(b.status)}${b.doc ? '<small class="sub">📎 ada dokumen</small>' : ""}</td>
        <td data-label="Aksi" class="act"><button class="btn ${primary ? "primary" : "ghost"} sm" data-detail="${b.id}">${act}</button></td>
      </tr>`;
          })
          .join("")
      : `<tr class="empty-row"><td colspan="7"><div class="empty"><strong>Tidak ada data</strong><span>Coba ubah filter atau kata kunci.</span></div></td></tr>`;

    const pend = visible().filter(
      (b) => b.status === (isTU ? "menunggu" : "diteruskan"),
    ).length;
    const c = $("#pendCount");
    c.hidden = !pend;
    c.textContent = pend;
  }

  $("#filterChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter = b.dataset.filter;
    $$("#filterChips .chip").forEach((c) =>
      c.classList.toggle("active", c === b),
    );
    renderRequests();
  });
  $("#searchBox").addEventListener("input", (e) => {
    query = e.target.value;
    renderRequests();
  });
  document.addEventListener("click", (e) => {
    const d = e.target.closest("[data-detail]");
    if (d) detailModal(d.dataset.detail);
  });

  /* ---------- Jadwal ---------- */
  let sched, cal;
  function initSchedule() {
    sched = createSchedule($("#schedRoot"), { showBooker: true, pageSize: 5 });
    cal = createCalendar($("#calRoot"), { onSelect: (d) => sched.setDate(d) });
    sched.setDate(U.today());
  }

  /* ---------- Data aula (TU): nama, kapasitas (slider), kursi ---------- */
  const CAP_MIN = 10,
    CAP_MAX = 1000,
    CAP_STEP = 10;
  const activeOf = (id) =>
    allBookings().filter(
      (b) =>
        b.roomId === id &&
        !U.INACTIVE.includes(b.status) &&
        b.endDate >= U.today(),
    );

  function renderRooms() {
    if (!isTU) return;
    const grid = $("#capGrid");
    if (
      grid.contains(document.activeElement) &&
      document.activeElement !== grid
    )
      return; // jangan timpa isian yang sedang diedit
    grid.innerHTML = Store.rooms
      .all()
      .map((r) => {
        const pct = ((r.capacity - CAP_MIN) / (CAP_MAX - CAP_MIN)) * 100;
        const active = activeOf(r.id);
        return `<article class="card pad cap-card" data-room="${r.id}">
        <header><h3>${U.esc(r.name)}</h3><span class="muted-sm">Standar: ${U.fmtNum(r.defaultCapacity)}</span></header>
        <div class="field"><label for="rn-${r.id}">Nama aula</label><input id="rn-${r.id}" data-name value="${U.esc(r.name)}" maxlength="40"></div>
        <div class="cap-big"><output id="out-${r.id}">${U.fmtNum(r.capacity)}</output><span>orang (kapasitas)</span></div>
        <input class="slider" type="range" min="${CAP_MIN}" max="${CAP_MAX}" step="${CAP_STEP}" value="${r.capacity}" data-cap style="--pct:${pct}%" aria-label="Kapasitas ${U.esc(r.name)}">
        <div class="slider-scale"><span>${CAP_MIN}</span><span>${CAP_MAX / 2}</span><span>${U.fmtNum(CAP_MAX)}</span></div>
        <div class="field"><label for="rs-${r.id}">Jumlah kursi</label><input id="rs-${r.id}" data-seats type="number" min="1" step="1" value="${r.seats || r.capacity}"></div>
        <p class="hint" data-note>${capNote(
          active.length,
          active.reduce((m, b) => Math.max(m, b.peserta), 0),
          active.filter((b) => b.peserta > r.capacity).length,
        )}</p>
        <div class="form-error" data-err hidden></div>
        <div class="cap-actions">
          <button type="button" class="btn ghost sm" data-capreset>Kembali ke standar</button>
          <button type="button" class="btn primary sm" data-capsave>Simpan data aula</button>
        </div>
      </article>`;
      })
      .join("");
  }

  function capNote(n, biggest, conflict) {
    if (!n) return "Belum ada peminjaman aktif di ruangan ini.";
    const base = `${n} peminjaman aktif/mendatang, peserta terbanyak ${U.fmtNum(biggest)} orang.`;
    return conflict
      ? `${base} ⚠ ${conflict} peminjaman akan melebihi kapasitas baru.`
      : base;
  }

  $("#capGrid").addEventListener("input", (e) => {
    const s = e.target.closest("[data-cap]");
    if (!s) return;
    const card = s.closest(".cap-card");
    const val = Number(s.value);
    s.style.setProperty(
      "--pct",
      ((val - CAP_MIN) / (CAP_MAX - CAP_MIN)) * 100 + "%",
    );
    card.querySelector("output").textContent = U.fmtNum(val);
    const active = activeOf(card.dataset.room);
    card.querySelector("[data-note]").textContent = capNote(
      active.length,
      active.reduce((m, b) => Math.max(m, b.peserta), 0),
      active.filter((b) => b.peserta > val).length,
    );
  });

  $("#capGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".cap-card");
    if (!card) return;
    const id = card.dataset.room;
    if (e.target.closest("[data-capreset]")) {
      const r = Store.rooms.get(id);
      const s = card.querySelector("[data-cap]");
      s.value = r.defaultCapacity;
      s.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (e.target.closest("[data-capsave]")) {
      const name = card.querySelector("[data-name]").value.trim();
      const cap = Number(card.querySelector("[data-cap]").value);
      const seats = Number(card.querySelector("[data-seats]").value);
      const errEl = card.querySelector("[data-err]");
      const errs = [];
      if (name.length < 3) errs.push("Nama aula minimal 3 karakter.");
      if (
        Store.rooms
          .all()
          .some(
            (r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase(),
          )
      )
        errs.push("Nama aula sudah dipakai.");
      if (!Number.isInteger(seats) || seats < 1)
        errs.push("Jumlah kursi harus angka ≥ 1.");
      else if (seats > cap)
        errs.push("Jumlah kursi tidak boleh melebihi kapasitas.");
      if (errs.length) {
        errEl.hidden = false;
        errEl.textContent = errs.join(" ");
        return;
      }
      Store.rooms.update(id, { name, capacity: cap, seats });
      UI.toast(
        `Data ${name} diperbarui: kapasitas ${U.fmtNum(cap)}, ${U.fmtNum(seats)} kursi.`,
        "ok",
      );
      document.activeElement.blur();
      renderAll();
    }
  });

  /* ---------- Akun pengguna (TU) ---------- */
  function renderUsers() {
    if (!isTU) return;
    $("#userBody").innerHTML = Store.users
      .all()
      .map((u) => {
        const isClient = u.role === "client";
        const on = u.active !== false;
        return `<tr>
        <td data-label="Nama"><span class="cell-user">${UI.avatarHtml(u, "sm")}<span>${U.esc(u.name)}</span></span></td>
        <td data-label="Username">${U.esc(u.username)}</td>
        <td data-label="Email">${U.esc(u.email)}</td>
        <td data-label="Peran / Unit">${U.typeLabel(u.type)}${isClient ? `<small class="sub">${U.esc(u.unit || "")}</small>` : ""}</td>
        <td data-label="NIDN">${U.esc(u.idNo || "—")}</td>
        <td data-label="Status"><span class="badge ${on ? "disetujui" : "dibatalkan"}">${on ? "Aktif" : "Nonaktif"}</span></td>
        <td data-label="Aksi" class="act">${
          isClient
            ? `<button class="btn ghost sm" data-edituser="${u.id}">Ubah</button><button class="btn ${on ? "danger" : "primary"} sm" data-toggleuser="${u.id}">${on ? "Nonaktifkan" : "Aktifkan"}</button>`
            : '<span class="muted-sm">—</span>'
        }</td>
      </tr>`;
      })
      .join("");
  }

  function userModal(u) {
    const edit = !!u;
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="field"><label for="aName">Nama lengkap</label><input id="aName" value="${U.esc(u ? u.name : "")}"></div>
      <div class="grid-2">
        <div class="field"><label for="aId">NIDN</label><input id="aId" inputmode="numeric" maxlength="${U.ID_RULE.max}" value="${U.esc(u ? u.idNo : "")}" placeholder="${U.ID_RULE.min}–${U.ID_RULE.max} angka"></div>
        <div class="field"><label for="aUnit">Unit</label><select id="aUnit">${Account.unitOptions(u ? u.unit : "")}</select></div>
      </div>
      <div class="field"><label for="aEmail">Email</label><input id="aEmail" type="email" value="${U.esc(u ? u.email : "")}"></div>
      <div class="field"><label for="aPhone">No. HP <span class="opt-tag">opsional</span></label><input id="aPhone" type="tel" value="${U.esc(u ? u.phone || "" : "")}"></div>
      ${edit ? `<div class="field"><label>Username</label><input value="${U.esc(u.username)}" disabled></div>` : '<div class="field"><label for="aUser">Username</label><input id="aUser" autocapitalize="none"></div>'}
      <div class="grid-2">
        <div class="field"><label for="aPass">${edit ? 'Password baru <span class="opt-tag">kosongkan jika tidak diganti</span>' : "Password"}</label><input id="aPass" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="aPass2">Ulangi password</label><input id="aPass2" type="password" autocomplete="new-password"></div>
      </div>
      <div class="form-error" role="alert" hidden></div>`;
    const idIn = body.querySelector("#aId");
    idIn.addEventListener("input", () => {
      idIn.value = idIn.value.replace(/\D/g, "").slice(0, U.ID_RULE.max);
    });
    UI.modal({
      title: edit ? "Ubah akun pemohon" : "Tambah akun pemohon",
      body,
      actions: [
        { label: "Batal", kind: "ghost" },
        {
          label: "Simpan",
          kind: "primary",
          onClick: (close) => {
            const d = {
              name: body.querySelector("#aName").value,
              idNo: idIn.value,
              unit: body.querySelector("#aUnit").value,
              email: body.querySelector("#aEmail").value,
              phone: body.querySelector("#aPhone").value,
              password: body.querySelector("#aPass").value,
              password2: body.querySelector("#aPass2").value,
            };
            if (!edit) d.username = body.querySelector("#aUser").value;
            const errs = Auth.validateAccount(d, {
              ignoreId: edit ? u.id : null,
              needPassword: !edit,
            });
            if (errs.length) {
              const el = body.querySelector(".form-error");
              el.hidden = false;
              el.innerHTML =
                errs.length > 1
                  ? "<ul>" +
                    errs.map((m) => `<li>${U.esc(m)}</li>`).join("") +
                    "</ul>"
                  : U.esc(errs[0]);
              return;
            }
            if (edit) {
              const patch = {
                name: d.name.trim(),
                idNo: d.idNo.trim(),
                unit: d.unit,
                email: d.email.trim(),
                phone: d.phone.trim(),
              };
              if (d.password) patch.password = d.password;
              Store.users.update(u.id, patch);
              UI.toast("Akun diperbarui.", "ok");
            } else {
              Store.users.add({
                id: U.uid("u-"),
                role: "client",
                type: "guru",
                name: d.name.trim(),
                username: d.username.trim(),
                email: d.email.trim(),
                password: d.password,
                idNo: d.idNo.trim(),
                phone: d.phone.trim(),
                unit: d.unit,
                active: true,
              });
              UI.toast("Akun pemohon ditambahkan.", "ok");
            }
            close();
            renderAll();
          },
        },
      ],
    });
  }

  if (isTU) {
    $("#addUserBtn").addEventListener("click", () => userModal(null));
    $("#userBody").addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edituser]");
      const tg = e.target.closest("[data-toggleuser]");
      if (ed) userModal(Store.users.get(ed.dataset.edituser));
      if (tg) {
        const u = Store.users.get(tg.dataset.toggleuser);
        if (!u) return;
        const on = u.active !== false;
        if (!on) {
          Store.users.update(u.id, { active: true });
          UI.toast(`Akun ${u.name} diaktifkan.`, "ok");
          renderAll();
          return;
        }
        if (
          await UI.confirm(
            `Nonaktifkan akun ${u.name}? Ia tidak bisa login, riwayat peminjamannya tetap tersimpan.`,
            { title: "Nonaktifkan akun", okLabel: "Nonaktifkan", danger: true },
          )
        ) {
          Store.users.update(u.id, { active: false });
          UI.toast("Akun dinonaktifkan.", "ok");
          renderAll();
        }
      }
    });
  }

  /* ---------- Rekap (Kepala Unit): periode & unit ---------- */
  function rekapRows() {
    const from = $("#rFrom").value,
      to = $("#rTo").value,
      unit = $("#rUnitSel").value;
    return visible()
      .filter(
        (b) =>
          (!from || b.endDate >= from) &&
          (!to || b.startDate <= to) &&
          (!unit || b.unit === unit),
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  function renderRekap() {
    if (!isKepala) return;
    const rows = rekapRows();
    const n = (s) => rows.filter((b) => b.status === s).length;
    const proses = rows.filter((b) => U.PENDING.includes(b.status)).length;
    $("#rekapStats").innerHTML = [
      ["semua", rows.length, "Total permohonan"],
      ["disetujui", n("disetujui"), "Disetujui"],
      ["ditolak", n("ditolak"), "Ditolak"],
      ["dibatalkan", n("dibatalkan"), "Dibatalkan"],
    ]
      .map(
        ([k, v, l]) =>
          `<div class="stat ${k}"><strong>${U.fmtNum(v)}</strong><span>${l}</span></div>`,
      )
      .join("");
    const units = $("#rUnitSel").value ? [$("#rUnitSel").value] : U.UNITS;
    $("#rekapUnit").innerHTML =
      units
        .map((un) => {
          const r = rows.filter((b) => b.unit === un);
          const c = (s) => r.filter((b) => b.status === s).length;
          return `<tr><td data-label="Unit">${U.esc(un)}</td><td data-label="Total">${r.length}</td><td data-label="Disetujui">${c("disetujui")}</td><td data-label="Ditolak">${c("ditolak")}</td><td data-label="Dibatalkan">${c("dibatalkan")}</td><td data-label="Diproses">${r.filter((b) => U.PENDING.includes(b.status)).length}</td></tr>`;
        })
        .join("") +
      `<tr class="total-row"><td><strong>Seluruh unit</strong></td><td>${rows.length}</td><td>${n("disetujui")}</td><td>${n("ditolak")}</td><td>${n("dibatalkan")}</td><td>${proses}</td></tr>`;
    $("#rekapBody").innerHTML = rows.length
      ? rows
          .map(
            (b) => `<tr>
      <td data-label="Kode"><code>${U.esc(b.code)}</code></td>
      <td data-label="Pemohon">${U.esc(b.nama)}${b.kegiatan ? `<small class="sub">${U.esc(b.kegiatan)}</small>` : ""}</td>
      <td data-label="Unit">${U.esc(b.unit || "-")}</td>
      <td data-label="Tanggal">${U.rangeLabel(b.startDate, b.endDate)}<small class="sub">${U.timeRange(b)}</small></td>
      <td data-label="Ruangan">${U.esc(roomName(b.roomId))}</td>
      <td data-label="Status">${U.badge(b.status)}</td></tr>`,
          )
          .join("")
      : '<tr class="empty-row"><td colspan="6"><div class="empty"><strong>Tidak ada data</strong><span>Ubah periode atau unit.</span></div></td></tr>';
  }
  if (isKepala) {
    const t = U.today();
    $("#rFrom").value = U.addDays(t, -60);
    $("#rTo").value = U.addDays(t, 60);
    $("#rUnitSel").innerHTML =
      '<option value="">Semua unit</option>' +
      U.UNITS.map((u) => `<option>${U.esc(u)}</option>`).join("");
    ["#rFrom", "#rTo", "#rUnitSel"].forEach((s) =>
      $(s).addEventListener("change", renderRekap),
    );
    $("#csvBtn").addEventListener("click", () => {
      const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
      const head = [
        "Kode",
        "Pemohon",
        "Unit",
        "Mulai",
        "Selesai",
        "Jam",
        "Ruangan",
        "Peserta",
        "Kegiatan",
        "Status",
        "Diputuskan oleh",
        "Waktu keputusan (WIB)",
        "Alasan penolakan",
      ];
      const lines = [head.map(q).join(",")].concat(
        rekapRows().map((b) =>
          [
            b.code,
            b.nama,
            b.unit,
            b.startDate,
            b.endDate,
            U.timeRange(b),
            roomName(b.roomId),
            b.peserta,
            b.kegiatan,
            U.STATUS[b.status],
            b.decidedBy,
            b.decidedAt ? U.wib(b.decidedAt) : "",
            b.alasan,
          ]
            .map(q)
            .join(","),
        ),
      );
      const url = URL.createObjectURL(
        new Blob(["﻿" + lines.join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap-peminjaman-${$("#rFrom").value}_${$("#rTo").value}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  /* ---------- Render semua + sinkron real-time ---------- */
  function renderAll() {
    renderSummary();
    renderRequests();
    renderRooms();
    renderUsers();
    renderRekap();
    if (cal) {
      cal.refresh();
      sched.refresh();
    }
    if (currentTab() === "notif") {
      Notify.render($("#notifList"), admin);
      Notify.markRead(admin);
    }
    Notify.updateBadge($("#notifCount"), admin);
  }

  Notify.watch(admin, () => renderAll());

  initSchedule();
  showTab(location.hash.slice(1));
})();
