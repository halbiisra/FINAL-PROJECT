/* RUMA — calendar.js
 * Komponen kalender bulanan. Klik tanggal -> onSelect(tanggalISO).
 * Dipakai bersama oleh mode client dan mode admin. */
function createCalendar(root, { onSelect, initialDate } = {}) {
  const start = U.parse(initialDate || U.today());
  let year = start.getFullYear();
  let month = start.getMonth();
  let selected = initialDate || U.today();
  let focusNav = null;

  /* Hitung penanda per tanggal untuk bulan yang tampil (pemesanan multi-hari ikut dihitung). */
  function marks() {
    const first = U.iso(new Date(year, month, 1));
    const last = U.iso(new Date(year, month + 1, 0));
    const m = {};
    Store.bookings.all().forEach(b => {
      if (b.status === 'ditolak' || b.endDate < first || b.startDate > last) return;
      let d = b.startDate < first ? first : b.startDate;
      const end = b.endDate > last ? last : b.endDate;
      while (d <= end) {
        (m[d] = m[d] || { disetujui: 0, menunggu: 0 })[b.status]++;
        d = U.addDays(d, 1);
      }
    });
    return m;
  }

  function render() {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // minggu dimulai Senin
    const total = new Date(year, month + 1, 0).getDate();
    const mk = marks();
    const today = U.today();

    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<span class="cal-pad" aria-hidden="true"></span>';
    for (let d = 1; d <= total; d++) {
      const key = `${year}-${U.pad(month + 1)}-${U.pad(d)}`;
      const info = mk[key];
      const cls = ['cal-day'];
      if (key === today) cls.push('is-today');
      if (key === selected) cls.push('is-selected');
      if (key < today) cls.push('is-past');
      const dots = info
        ? `<span class="cal-dots">${info.disetujui ? '<i class="dot ok"></i>' : ''}${info.menunggu ? '<i class="dot wait"></i>' : ''}</span>`
        : '';
      const label = `${U.longDate(key)}${info ? `, ${info.disetujui + info.menunggu} jadwal` : ', kosong'}`;
      cells += `<button type="button" class="${cls.join(' ')}" data-date="${key}" aria-label="${label}" aria-pressed="${key === selected}">${d}${dots}</button>`;
    }

    root.innerHTML = `
      <div class="cal-head">
        <button type="button" class="icon-btn" data-nav="-1" aria-label="Bulan sebelumnya">‹</button>
        <div class="cal-title"><strong>${U.MONTHS[month]}</strong> <span>${year}</span></div>
        <button type="button" class="icon-btn" data-nav="1" aria-label="Bulan berikutnya">›</button>
      </div>
      <div class="cal-grid cal-dow" aria-hidden="true">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-foot">
        <span class="legend"><i class="dot ok"></i> Disetujui</span>
        <span class="legend"><i class="dot wait"></i> Menunggu</span>
        <button type="button" class="btn ghost sm" data-today>Hari ini</button>
      </div>`;
    if (focusNav) { const b = root.querySelector(`[data-nav="${focusNav}"]`); if (b) b.focus(); focusNav = null; }
  }

  root.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const n = Number(nav.dataset.nav);
      month += n;
      if (month < 0) { month = 11; year--; }
      if (month > 11) { month = 0; year++; }
      focusNav = String(n);
      render();
      return;
    }
    if (e.target.closest('[data-today]')) {
      const t = U.parse(U.today());
      year = t.getFullYear(); month = t.getMonth(); selected = U.today();
      render(); if (onSelect) onSelect(selected);
      return;
    }
    const day = e.target.closest('[data-date]');
    if (day) {
      selected = day.dataset.date;
      render();
      const again = root.querySelector(`[data-date="${selected}"]`);
      if (again) again.focus();
      if (onSelect) onSelect(selected);
    }
  });

  render();
  return { refresh: render, getSelected: () => selected };
}
