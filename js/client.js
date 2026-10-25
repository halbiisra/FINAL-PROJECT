/* RUMA — client.js
 * Mode client: kalender & jadwal, formulir peminjaman (dengan slider kapasitas),
 * status "Menunggu", riwayat, dan kotak email. Admin juga boleh membuka halaman ini. */
(() => {
  const user = Auth.guard(['client', 'admin']);
  if (!user) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Header ---------- */
  $('#userName').textContent = user.name;
  $('#userRole').textContent = user.role === 'admin' ? 'Admin (pratinjau client)' : U.typeLabel(user.type);
  $('#avatar').textContent = user.name.trim().charAt(0).toUpperCase();
  if (user.role === 'admin') $('#adminLink').hidden = false;
  $('#logoutBtn').addEventListener('click', Auth.logout);

  /* ---------- Tab ---------- */
  const TABS = ['jadwal', 'pinjam', 'riwayat', 'email'];
  function showTab(name) {
    if (!TABS.includes(name)) name = 'jadwal';
    TABS.forEach(t => {
      $('#tab-' + t).hidden = t !== name;
      const b = $(`[data-tab="${t}"]`);
      b.classList.toggle('active', t === name);
      if (t === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    history.replaceState(null, '', '#' + name);
    if (name === 'riwayat') renderHistory();
    if (name === 'email') { renderMail(); markMailRead(); }
    if (name === 'pinjam') renderAvailability();
    window.scrollTo({ top: 0 });
  }
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ---------- Jadwal ---------- */
  let pickedDate = U.today();
  const sched = createSchedule($('#schedRoot'), { pageSize: 4 });
  const cal = createCalendar($('#calRoot'), {
    initialDate: pickedDate,
    onSelect: d => { pickedDate = d; sched.setDate(d); },
  });
  sched.setDate(pickedDate);

  $('#pickDate').addEventListener('click', () => {
    if (pickedDate < U.today()) { UI.toast('Tanggal tersebut sudah lewat. Pilih tanggal hari ini atau setelahnya.', 'warn'); return; }
    $('#fStartDate').value = pickedDate;
    if ($('#fEndDate').value < pickedDate) $('#fEndDate').value = pickedDate;
    showTab('pinjam');
    $('#fStartDate').dispatchEvent(new Event('change'));
  });

  /* ---------- Formulir ---------- */
  const form = $('#bookForm');
  const slider = $('#fPeserta');
  let roomId = Store.rooms.all()[0].id;

  function renderRooms() {
    const rooms = Store.rooms.all();
    if (!rooms.find(r => r.id === roomId)) roomId = rooms[0].id;
    $('#roomPick').innerHTML = rooms.map(r => `
      <label class="room-opt">
        <input type="radio" name="room" value="${r.id}" ${r.id === roomId ? 'checked' : ''}>
        <span class="room-card"><strong>${U.esc(r.name)}</strong><small>Kapasitas ${U.fmtNum(r.capacity)} orang</small></span>
      </label>`).join('');
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
    slider.style.setProperty('--pct', pct + '%');
    $('#pesertaOut').textContent = U.fmtNum(val) + ' orang';
    $('#sliderMin').textContent = U.fmtNum(min);
    $('#sliderMid').textContent = U.fmtNum(Math.round((min + cap) / 2));
    $('#sliderMax').textContent = U.fmtNum(cap);
    const used = Math.round((val / cap) * 100);
    $('#meterFill').style.width = used + '%';
    $('#meterText').textContent = `${used}% dari kapasitas ${room.name} (${U.fmtNum(cap)} orang)`;
  }

  function renderAvailability() {
    const room = Store.rooms.get(roomId);
    const d = $('#fStartDate').value;
    const list = $('#availList');
    if (!d) { $('#availHead').textContent = 'Pilih tanggal mulai untuk melihat jadwal ruangan.'; list.innerHTML = ''; return; }
    $('#availHead').textContent = `${room.name} · ${U.longDate(d)}`;
    const items = Store.bookings.all()
      .filter(b => b.roomId === roomId && b.status !== 'ditolak' && b.startDate <= d && d <= b.endDate)
      .sort((a, b) => U.toMin(a.startTime) - U.toMin(b.startTime));
    list.innerHTML = items.length
      ? items.map(b => `<li><span>${U.timeRange(b)}</span>${U.badge(b.status)}</li>`).join('')
      : '<li class="free">Belum ada jadwal — ruangan kosong 🎉</li>';
  }

  function applyUserToForm() {
    $('#fNama').value = user.name;
    $('#fId').value = user.idNo || '';
    $('#fPhone').value = user.phone || '';
    $('#fIdLabel').textContent = U.idLabel(user.type);
    $('#fIdHint').textContent = user.type === 'mahasiswa' ? 'Isi dengan NIM (mahasiswa).' : user.type === 'external' ? 'Isi nomor identitas (KTP).' : 'Isi dengan NIP (dosen/staf).';
    $('#phoneField').hidden = user.type !== 'external';
  }

  function resetForm() {
    form.reset();
    applyUserToForm();
    const t = U.today();
    $('#fStartDate').min = $('#fEndDate').min = t;
    $('#fStartDate').value = $('#fEndDate').value = pickedDate >= t ? pickedDate : t;
    $('#fStartTime').value = '09:00';
    $('#fEndTime').value = '11:00';
    renderRooms();
    slider.value = Math.min(50, Store.rooms.get(roomId).capacity);
    syncSlider();
    $('#formError').hidden = true;
    renderAvailability();
  }

  $('#roomPick').addEventListener('change', e => {
    if (e.target.name === 'room') { roomId = e.target.value; syncSlider(); renderAvailability(); }
  });
  slider.addEventListener('input', syncSlider);
  $('#fStartDate').addEventListener('change', () => {
    const s = $('#fStartDate').value;
    $('#fEndDate').min = s || U.today();
    if (s && $('#fEndDate').value < s) $('#fEndDate').value = s;
    renderAvailability();
  });
  $('#resetBtn').addEventListener('click', resetForm);

  $('#termsBtn').addEventListener('click', () => UI.modal({
    title: 'Ketentuan peminjaman',
    body: `<ol class="terms">
      <li>Ruangan digunakan pada jam operasional 07.00 – 21.00.</li>
      <li>Jumlah peserta tidak boleh melebihi kapasitas ruangan yang ditetapkan admin.</li>
      <li>Permohonan baru berlaku setelah berstatus <strong>Disetujui</strong>. Admin berhak menolak bila jadwal bentrok atau data tidak lengkap.</li>
      <li>Peminjam menjaga kebersihan dan fasilitas ruangan.</li>
      <li>Pembatalan dapat dilakukan sendiri selama status masih <strong>Menunggu</strong>.</li>
    </ol>`,
    actions: [{ label: 'Mengerti', kind: 'primary' }],
  }));

  function collect() {
    return {
      nama: $('#fNama').value.trim(),
      idNo: $('#fId').value.trim(),
      phone: $('#fPhone').value.trim(),
      startDate: $('#fStartDate').value,
      endDate: $('#fEndDate').value,
      startTime: $('#fStartTime').value,
      endTime: $('#fEndTime').value,
      roomId,
      peserta: Number(slider.value),
      kegiatan: $('#fKegiatan').value.trim(),
      agree: $('#fAgree').checked,
    };
  }

  function validate(v) {
    const e = [];
    const room = Store.rooms.get(v.roomId);
    if (v.nama.length < 3) e.push('Nama lengkap minimal 3 karakter.');
    if (!v.idNo) e.push(U.idLabel(user.type) + ' wajib diisi.');
    if (user.type === 'external' && !/^[0-9+\-\s]{8,16}$/.test(v.phone)) e.push('No. HP wajib diisi untuk pengguna external (8–16 digit).');
    if (!v.startDate) e.push('Tanggal mulai wajib diisi.');
    else if (v.startDate < U.today()) e.push('Tanggal mulai tidak boleh sebelum hari ini.');
    if (!v.endDate) e.push('Tanggal selesai wajib diisi.');
    else if (v.startDate && v.endDate < v.startDate) e.push('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    if (!v.startTime || !v.endTime) e.push('Jam mulai dan jam selesai wajib diisi.');
    else {
      if (U.toMin(v.endTime) <= U.toMin(v.startTime)) e.push('Jam selesai harus setelah jam mulai.');
      if (U.toMin(v.startTime) < U.toMin(U.OPEN_HOUR) || U.toMin(v.endTime) > U.toMin(U.CLOSE_HOUR)) e.push('Jam peminjaman harus dalam 07.00 – 21.00.');
    }
    if (!room) e.push('Pilih ruangan.');
    else if (v.peserta > room.capacity) e.push(`Jumlah peserta melebihi kapasitas ${room.name} (${U.fmtNum(room.capacity)} orang).`);
    if (!v.agree) e.push('Centang persetujuan ketentuan peminjaman.');
    if (!e.length) {
      const c = U.findConflict(v, Store.bookings.all(), ['disetujui']);
      if (c) e.push(`Bentrok dengan jadwal yang sudah disetujui: ${room.name}, ${U.rangeLabel(c.startDate, c.endDate)}, ${U.timeRange(c)}. Pilih jam atau ruangan lain.`);
    }
    return e;
  }

  function showErrors(list) {
    const el = $('#formError');
    el.hidden = !list.length;
    el.innerHTML = list.length > 1 ? '<ul>' + list.map(m => `<li>${U.esc(m)}</li>`).join('') + '</ul>' : U.esc(list[0] || '');
    if (list.length) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = collect();
    const errors = validate(v);
    showErrors(errors);
    if (errors.length) return;

    const b = Store.bookings.add({
      id: U.uid('b-'), code: U.bookingCode(), userId: user.id,
      nama: v.nama, idNo: v.idNo, phone: v.phone,
      startDate: v.startDate, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
      roomId: v.roomId, peserta: v.peserta, kegiatan: v.kegiatan,
      status: 'menunggu', note: '', createdAt: Date.now(),
    });
    Mailer.send(b, 'diterima');

    const room = Store.rooms.get(b.roomId);
    $('#thanksSummary').innerHTML = [
      ['Kode', b.code], ['Ruangan', room.name], ['Tanggal', U.rangeLabel(b.startDate, b.endDate)],
      ['Waktu', U.timeRange(b)], ['Peserta', U.fmtNum(b.peserta) + ' orang'],
    ].map(([k, val]) => `<div><dt>${k}</dt><dd>${U.esc(val)}</dd></div>`).join('');
    $('#mailBtn').href = Mailer.mailtoFor(b, 'diterima');
    $('#formArea').hidden = true;
    $('#thanks').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    snapshot = statusMap();
    refreshAll();
  });

  $('#againBtn').addEventListener('click', () => { $('#thanks').hidden = true; $('#formArea').hidden = false; resetForm(); });
  $('#toHistory').addEventListener('click', () => { $('#thanks').hidden = true; $('#formArea').hidden = false; resetForm(); showTab('riwayat'); });

  /* ---------- Riwayat ---------- */
  const mine = () => Store.bookings.all().filter(b => b.userId === user.id).sort((a, b) => b.createdAt - a.createdAt);

  function renderHistory() {
    const list = mine();
    const pending = list.filter(b => b.status === 'menunggu').length;
    const c = $('#histCount'); c.hidden = !pending; c.textContent = pending;
    $('#histList').innerHTML = list.length ? list.map(b => {
      const room = Store.rooms.get(b.roomId);
      const over = room && b.peserta > room.capacity && b.status !== 'ditolak';
      return `<article class="card pad hist-item">
        <div class="hist-top"><strong>${U.esc(b.kegiatan || 'Peminjaman ' + (room ? room.name : ''))}</strong>${U.badge(b.status)}</div>
        <dl class="hist-meta">
          <div><dt>Kode</dt><dd>${U.esc(b.code)}</dd></div>
          <div><dt>Ruangan</dt><dd>${U.esc(room ? room.name : '-')}</dd></div>
          <div><dt>Tanggal</dt><dd>${U.rangeLabel(b.startDate, b.endDate)}</dd></div>
          <div><dt>Waktu</dt><dd>${U.timeRange(b)}</dd></div>
          <div><dt>Peserta</dt><dd>${U.fmtNum(b.peserta)} orang</dd></div>
        </dl>
        ${over ? '<p class="form-error">Jumlah peserta kini melebihi kapasitas ruangan. Hubungi admin.</p>' : ''}
        ${b.note ? `<p class="admin-note"><strong>Catatan admin:</strong> ${U.esc(b.note)}</p>` : ''}
        <div class="hist-actions">
          <a class="btn ghost sm" href="${Mailer.mailtoFor(b, b.status)}">Kirim ke email</a>
          ${b.status === 'menunggu' ? `<button type="button" class="btn danger sm" data-cancel="${b.id}">Batalkan</button>` : ''}
        </div>
      </article>`;
    }).join('') : `<div class="empty card pad"><strong>Belum ada peminjaman</strong><span>Ajukan lewat tab “Pinjam Ruang”.</span></div>`;
  }

  $('#histList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-cancel]');
    if (!btn) return;
    const b = Store.bookings.get(btn.dataset.cancel);
    if (!b || b.status !== 'menunggu') { UI.toast('Permohonan sudah diproses admin dan tidak dapat dibatalkan.', 'warn'); refreshAll(); return; }
    if (await UI.confirm(`Batalkan permohonan ${b.code}?`, { title: 'Batalkan peminjaman', okLabel: 'Ya, batalkan', danger: true })) {
      Store.bookings.remove(b.id);
      UI.toast('Permohonan dibatalkan.', 'ok');
      snapshot = statusMap();
      refreshAll();
    }
  });

  /* ---------- Kotak email ---------- */
  const myMails = () => Store.mails.all().filter(m => m.to.toLowerCase() === user.email.toLowerCase()).sort((a, b) => b.createdAt - a.createdAt);

  function updateMailCount() {
    const n = myMails().filter(m => !m.read).length;
    const c = $('#mailCount'); c.hidden = !n; c.textContent = n;
  }
  function markMailRead() {
    myMails().filter(m => !m.read).forEach(m => Store.mails.update(m.id, { read: true }));
    updateMailCount();
  }
  function renderMail() {
    $('#mailAddr').textContent = user.email;
    const list = myMails();
    $('#mailList').innerHTML = list.length ? list.map(m => `
      <details class="card mail ${m.read ? '' : 'unread'}">
        <summary><span class="mail-sub">${U.esc(m.subject)}</span><time>${U.timeAgo(m.createdAt)}</time></summary>
        <pre>${U.esc(m.body)}</pre>
      </details>`).join('') : '<div class="empty card pad"><strong>Kotak email kosong</strong><span>Notifikasi status peminjaman akan muncul di sini.</span></div>';
  }

  /* ---------- Sinkron dengan admin ---------- */
  const statusMap = () => Object.fromEntries(mine().map(b => [b.id, b.status]));
  let snapshot = statusMap();

  function refreshAll() {
    cal.refresh();
    sched.refresh();
    const sel = slider.value;
    renderRooms();
    slider.value = sel;
    syncSlider();
    renderAvailability();
    renderHistory();
    if (!$('#tab-email').hidden) { renderMail(); markMailRead(); } else updateMailCount();
  }

  Store.onChange(() => {
    const now = statusMap();
    Object.keys(now).forEach(id => {
      if (snapshot[id] && snapshot[id] !== now[id]) {
        const b = Store.bookings.get(id);
        UI.toast(`Peminjaman ${b.code} kini ${U.STATUS[now[id]].toUpperCase()}.`, now[id] === 'disetujui' ? 'ok' : now[id] === 'ditolak' ? 'bad' : 'info', 6000);
      }
    });
    snapshot = now;
    refreshAll();
  });

  /* ---------- Mulai ---------- */
  resetForm();
  renderHistory();
  updateMailCount();
  showTab(location.hash.slice(1));
})();
