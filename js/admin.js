/* RUMA — admin.js
 * Mode admin: ringkasan, persetujuan permintaan, jadwal, slider kapasitas aula,
 * dan daftar pengguna. Data dibagi dengan mode client lewat Store. */
(() => {
  const admin = Auth.guard(['admin']);
  if (!admin) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  $('#userName').textContent = admin.name;
  $('#avatar').textContent = admin.name.trim().charAt(0).toUpperCase();
  $('#logoutBtn').addEventListener('click', Auth.logout);

  /* ---------- Tab ---------- */
  const TABS = ['ringkasan', 'permintaan', 'jadwal', 'kapasitas', 'pengguna'];
  function showTab(name) {
    if (!TABS.includes(name)) name = 'ringkasan';
    TABS.forEach(t => {
      $('#tab-' + t).hidden = t !== name;
      const b = $(`[data-tab="${t}"]`);
      b.classList.toggle('active', t === name);
      if (t === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    history.replaceState(null, '', '#' + name);
    renderAll();
    window.scrollTo({ top: 0 });
  }
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  const roomName = id => { const r = Store.rooms.get(id); return r ? r.name : '-'; };
  const allBookings = () => Store.bookings.all();

  /* ---------- Keputusan (setuju / tolak / kembalikan) ---------- */
  function decide(b, status, note) {
    if (status === 'disetujui') {
      const room = Store.rooms.get(b.roomId);
      if (room && b.peserta > room.capacity) {
        UI.toast(`Tidak bisa disetujui: ${U.fmtNum(b.peserta)} peserta melebihi kapasitas ${room.name} (${U.fmtNum(room.capacity)}). Naikkan kapasitas di tab Kapasitas Aula.`, 'bad', 7000);
        return false;
      }
      const c = U.findConflict(b, allBookings(), ['disetujui'], b.id);
      if (c) {
        UI.toast(`Bentrok dengan ${c.code} (${U.rangeLabel(c.startDate, c.endDate)}, ${U.timeRange(c)}).`, 'bad', 7000);
        return false;
      }
    }
    const updated = Store.bookings.update(b.id, { status, note: note || '', decidedAt: Date.now(), decidedBy: admin.name });
    Mailer.send(updated, status);
    UI.toast(`${b.code} → ${U.STATUS[status]}. Email notifikasi terkirim ke pemohon.`, status === 'disetujui' ? 'ok' : 'info');
    renderAll();
    return true;
  }

  function detailModal(id) {
    const b = Store.bookings.get(id);
    if (!b) return;
    const room = Store.rooms.get(b.roomId);
    const owner = Store.users.get(b.userId);
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="detail-top"><strong>${U.esc(b.kegiatan || 'Peminjaman ' + roomName(b.roomId))}</strong>${U.badge(b.status)}</div>
      <dl class="detail">
        <div><dt>Kode</dt><dd>${U.esc(b.code)}</dd></div>
        <div><dt>Peminjam</dt><dd>${U.esc(b.nama)}</dd></div>
        <div><dt>${U.idLabel(owner ? owner.type : 'dosen')}</dt><dd>${U.esc(b.idNo)}</dd></div>
        <div><dt>Email</dt><dd>${U.esc(owner ? owner.email : '-')}</dd></div>
        ${b.phone ? `<div><dt>No. HP</dt><dd>${U.esc(b.phone)}</dd></div>` : ''}
        <div><dt>Ruangan</dt><dd>${U.esc(roomName(b.roomId))}</dd></div>
        <div><dt>Tanggal</dt><dd>${U.rangeLabel(b.startDate, b.endDate)}</dd></div>
        <div><dt>Waktu</dt><dd>${U.timeRange(b)}</dd></div>
        <div><dt>Peserta</dt><dd>${U.fmtNum(b.peserta)} orang${room && b.peserta > room.capacity ? ' <span class="badge ditolak">melebihi kapasitas</span>' : ''}</dd></div>
        <div><dt>Diajukan</dt><dd>${U.timeAgo(b.createdAt)}</dd></div>
      </dl>
      <div class="field"><label for="dNote">Catatan untuk pemohon <span class="opt-tag">opsional, ikut dikirim di email</span></label>
        <textarea id="dNote" rows="3" maxlength="240">${U.esc(b.note || '')}</textarea></div>`;
    const note = () => body.querySelector('#dNote').value.trim();

    const actions = [{ label: 'Tutup', kind: 'ghost' }];
    actions.push({
      label: 'Hapus', kind: 'danger',
      onClick: async close => {
        if (await UI.confirm(`Hapus permintaan ${b.code} secara permanen?`, { title: 'Hapus permintaan', okLabel: 'Hapus', danger: true })) {
          Store.bookings.remove(b.id); close(); UI.toast('Permintaan dihapus.', 'ok'); renderAll();
        }
      },
    });
    if (b.status !== 'ditolak') actions.push({ label: 'Tolak', kind: 'warn', onClick: close => { if (decide(b, 'ditolak', note())) close(); } });
    if (b.status !== 'disetujui') actions.push({ label: 'Setujui', kind: 'primary', onClick: close => { if (decide(b, 'disetujui', note())) close(); } });
    UI.modal({ title: 'Detail permintaan', body, actions, wide: true });
  }

  /* ---------- Ringkasan ---------- */
  function renderSummary() {
    const bs = allBookings();
    const t = U.today();
    const count = s => bs.filter(b => b.status === s).length;
    const tiles = [
      ['menunggu', count('menunggu'), 'Menunggu persetujuan'],
      ['disetujui', bs.filter(b => b.status === 'disetujui' && b.endDate >= t).length, 'Disetujui (mendatang)'],
      ['ditolak', count('ditolak'), 'Ditolak'],
      ['user', Store.users.all().filter(u => u.role === 'client').length, 'Pengguna client'],
    ];
    $('#stats').innerHTML = tiles.map(([k, n, label]) => `<div class="stat ${k}"><strong>${U.fmtNum(n)}</strong><span>${label}</span></div>`).join('');

    const pend = bs.filter(b => b.status === 'menunggu').sort((a, b) => a.createdAt - b.createdAt).slice(0, 5);
    $('#quickPending').innerHTML = pend.length ? pend.map(b => `
      <div class="qrow">
        <div><strong>${U.esc(b.nama)}</strong><small>${roomName(b.roomId)} · ${U.rangeLabel(b.startDate, b.endDate)} · ${U.timeRange(b)}</small></div>
        <div class="qact"><button class="btn primary sm" data-approve="${b.id}">Setujui</button><button class="btn ghost sm" data-detail="${b.id}">Detail</button></div>
      </div>`).join('') : '<div class="empty"><strong>Semua beres 🎉</strong><span>Tidak ada permintaan yang menunggu.</span></div>';

    const up = bs.filter(b => b.status === 'disetujui' && b.endDate >= t)
      .sort((a, b) => (a.startDate + a.startTime).localeCompare(b.startDate + b.startTime)).slice(0, 5);
    $('#upcoming').innerHTML = up.length ? up.map(b => `
      <div class="qrow">
        <div><strong>${U.esc(b.kegiatan || b.nama)}</strong><small>${roomName(b.roomId)} · ${U.rangeLabel(b.startDate, b.endDate)} · ${U.timeRange(b)}</small></div>
        <span class="muted-sm">${U.fmtNum(b.peserta)} org</span>
      </div>`).join('') : '<div class="empty"><strong>Belum ada jadwal</strong><span>Jadwal yang disetujui tampil di sini.</span></div>';
  }

  /* ---------- Permintaan ---------- */
  let filter = 'semua';
  let query = '';
  function renderRequests() {
    const q = query.trim().toLowerCase();
    const list = allBookings()
      .filter(b => filter === 'semua' || b.status === filter)
      .filter(b => !q || [b.nama, b.code, b.kegiatan, b.idNo].join(' ').toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
    $('#reqBody').innerHTML = list.length ? list.map(b => {
      const room = Store.rooms.get(b.roomId);
      const over = room && b.peserta > room.capacity;
      return `<tr>
        <td data-label="Kode"><code>${U.esc(b.code)}</code></td>
        <td data-label="Peminjam">${U.esc(b.nama)}<small class="sub">${U.esc(b.kegiatan || b.idNo)}</small></td>
        <td data-label="Tanggal">${U.rangeLabel(b.startDate, b.endDate)}</td>
        <td data-label="Waktu">${U.timeRange(b)}</td>
        <td data-label="Ruangan">${U.esc(room ? room.name : '-')}<small class="sub ${over ? 'bad-text' : ''}">${U.fmtNum(b.peserta)} peserta${over ? ' · melebihi kapasitas' : ''}</small></td>
        <td data-label="Status">${U.badge(b.status)}</td>
        <td data-label="Aksi" class="act">
          ${b.status === 'menunggu' ? `<button class="btn primary sm" data-approve="${b.id}">Setujui</button><button class="btn warn sm" data-reject="${b.id}">Tolak</button>` : ''}
          <button class="btn ghost sm" data-detail="${b.id}">Detail</button>
        </td>
      </tr>`;
    }).join('') : `<tr class="empty-row"><td colspan="7"><div class="empty"><strong>Tidak ada data</strong><span>Coba ubah filter atau kata kunci.</span></div></td></tr>`;

    const pend = allBookings().filter(b => b.status === 'menunggu').length;
    const c = $('#pendCount'); c.hidden = !pend; c.textContent = pend;
  }

  $('#filterChips').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    $$('#filterChips .chip').forEach(c => c.classList.toggle('active', c === b));
    renderRequests();
  });
  $('#searchBox').addEventListener('input', e => { query = e.target.value; renderRequests(); });

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-approve]');
    const r = e.target.closest('[data-reject]');
    const d = e.target.closest('[data-detail]');
    if (a) { const b = Store.bookings.get(a.dataset.approve); if (b) decide(b, 'disetujui', ''); }
    else if (r) detailModal(r.dataset.reject);
    else if (d) detailModal(d.dataset.detail);
  });

  /* ---------- Jadwal ---------- */
  let sched, cal;
  function initSchedule() {
    sched = createSchedule($('#schedRoot'), { showBooker: true, pageSize: 5 });
    cal = createCalendar($('#calRoot'), { onSelect: d => sched.setDate(d) });
    sched.setDate(U.today());
  }

  /* ---------- Kapasitas aula (mode slider) ---------- */
  const CAP_MIN = 10, CAP_MAX = 1000, CAP_STEP = 10;
  let capDraft = {}; // perubahan slider yang belum disimpan, per ruangan

  function renderCapacity() {
    // jangan timpa slider yang sedang digeser
    if ($('#capGrid').contains(document.activeElement) && document.activeElement.type === 'range') return;
    $('#capGrid').innerHTML = Store.rooms.all().map(r => {
      const val = capDraft[r.id] != null ? capDraft[r.id] : r.capacity;
      const active = allBookings().filter(b => b.roomId === r.id && b.status !== 'ditolak' && b.endDate >= U.today());
      const biggest = active.reduce((m, b) => Math.max(m, b.peserta), 0);
      const pct = ((val - CAP_MIN) / (CAP_MAX - CAP_MIN)) * 100;
      const conflict = active.filter(b => b.peserta > val).length;
      return `<article class="card pad cap-card" data-room="${r.id}">
        <header><h3>${U.esc(r.name)}</h3><span class="muted-sm">Standar: ${U.fmtNum(r.defaultCapacity)}</span></header>
        <div class="cap-big"><output id="out-${r.id}">${U.fmtNum(val)}</output><span>orang</span></div>
        <input class="slider" type="range" min="${CAP_MIN}" max="${CAP_MAX}" step="${CAP_STEP}" value="${val}" data-cap="${r.id}" style="--pct:${pct}%" aria-label="Kapasitas ${U.esc(r.name)}">
        <div class="slider-scale"><span>${CAP_MIN}</span><span>${CAP_MAX / 2}</span><span>${U.fmtNum(CAP_MAX)}</span></div>
        <p class="hint" id="capNote-${r.id}">${capNote(active.length, biggest, conflict)}</p>
        <div class="cap-actions">
          <button type="button" class="btn ghost sm" data-capreset="${r.id}">Kembali ke standar</button>
          <button type="button" class="btn primary sm" data-capsave="${r.id}" ${val === r.capacity ? 'disabled' : ''}>Simpan kapasitas</button>
        </div>
      </article>`;
    }).join('');
  }

  function capNote(n, biggest, conflict) {
    if (!n) return 'Belum ada peminjaman aktif di ruangan ini.';
    const base = `${n} peminjaman aktif/mendatang, peserta terbanyak ${U.fmtNum(biggest)} orang.`;
    return conflict ? `${base} ⚠ ${conflict} peminjaman akan melebihi kapasitas baru.` : base;
  }

  $('#capGrid').addEventListener('input', e => {
    const s = e.target.closest('[data-cap]');
    if (!s) return;
    const id = s.dataset.cap;
    const val = Number(s.value);
    capDraft[id] = val;
    s.style.setProperty('--pct', ((val - CAP_MIN) / (CAP_MAX - CAP_MIN)) * 100 + '%');
    $('#out-' + id).textContent = U.fmtNum(val);
    const room = Store.rooms.get(id);
    const card = s.closest('.cap-card');
    card.querySelector('[data-capsave]').disabled = val === room.capacity;
    const active = allBookings().filter(b => b.roomId === id && b.status !== 'ditolak' && b.endDate >= U.today());
    $('#capNote-' + id).textContent = capNote(active.length, active.reduce((m, b) => Math.max(m, b.peserta), 0), active.filter(b => b.peserta > val).length);
  });

  $('#capGrid').addEventListener('click', e => {
    const save = e.target.closest('[data-capsave]');
    const reset = e.target.closest('[data-capreset]');
    if (save) {
      const id = save.dataset.capsave;
      const r = Store.rooms.get(id);
      Store.rooms.update(id, { capacity: capDraft[id] });
      delete capDraft[id];
      UI.toast(`Kapasitas ${r.name} diperbarui menjadi ${U.fmtNum(Store.rooms.get(id).capacity)} orang.`, 'ok');
      renderAll();
    }
    if (reset) {
      const id = reset.dataset.capreset;
      const r = Store.rooms.get(id);
      capDraft[id] = r.defaultCapacity;
      document.activeElement.blur();
      renderCapacity();
    }
  });

  /* ---------- Pengguna ---------- */
  function renderUsers() {
    $('#userBody').innerHTML = Store.users.all().map(u => `<tr>
      <td data-label="Nama">${U.esc(u.name)}${u.role === 'admin' ? ' <span class="badge disetujui">admin</span>' : ''}</td>
      <td data-label="Username">${U.esc(u.username)}</td>
      <td data-label="Email">${U.esc(u.email)}</td>
      <td data-label="Tipe">${U.typeLabel(u.type)}</td>
      <td data-label="ID">${U.esc(u.idNo)}${u.phone ? `<small class="sub">${U.esc(u.phone)}</small>` : ''}</td>
      <td data-label="Aksi" class="act">${u.id === admin.id || u.role === 'admin' ? '<span class="muted-sm">—</span>' : `<button class="btn danger sm" data-deluser="${u.id}">Hapus</button>`}</td>
    </tr>`).join('');
  }
  $('#userBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-deluser]');
    if (!b) return;
    const u = Store.users.get(b.dataset.deluser);
    if (u && await UI.confirm(`Hapus akun ${u.name}? Riwayat peminjamannya tetap tersimpan.`, { title: 'Hapus pengguna', okLabel: 'Hapus', danger: true })) {
      Store.users.remove(u.id); UI.toast('Akun dihapus.', 'ok'); renderAll();
    }
  });

  /* ---------- Render semua + sinkron real-time ---------- */
  function renderAll() {
    renderSummary();
    renderRequests();
    renderCapacity();
    renderUsers();
    if (cal) { cal.refresh(); sched.refresh(); }
  }

  let knownPending = new Set(allBookings().filter(b => b.status === 'menunggu').map(b => b.id));
  Store.onChange(key => {
    if (key === 'ruma.bookings') {
      const now = allBookings().filter(b => b.status === 'menunggu');
      const fresh = now.filter(b => !knownPending.has(b.id));
      if (fresh.length) UI.toast(`Permintaan baru dari ${fresh.map(b => b.nama).join(', ')}.`, 'info', 6000);
      knownPending = new Set(now.map(b => b.id));
    }
    renderAll();
  });

  initSchedule();
  showTab(location.hash.slice(1));
})();
