/* RUMA — schedule.js
 * Tabel "Jadwal Peminjaman Aula Sekolah Tunas Dharma" untuk tanggal terpilih,
 * dengan tombol Next » / « Prev. Dipakai bersama oleh mode client dan admin. */
function createSchedule(root, { showBooker = false, pageSize = 4 } = {}) {
  let date = U.today();
  let page = 0;

  function items() {
    return Store.bookings
      .all()
      .filter(
        (b) =>
          !U.INACTIVE.includes(b.status) &&
          b.startDate <= date &&
          date <= b.endDate,
      )
      .sort((a, b) => U.toMin(a.startTime) - U.toMin(b.startTime));
  }

  function render() {
    const list = items();
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.min(page, pages - 1);
    const rows = list
      .slice(page * pageSize, (page + 1) * pageSize)
      .map((b) => {
        const room = Store.rooms.get(b.roomId);
        return `<tr>
        <td data-label="Hari / Tanggal">${U.longDate(date)}</td>
        <td data-label="Waktu">${U.timeRange(b)}</td>
        <td data-label="Ruangan">${U.esc(room ? room.name : "-")}<small class="sub">${U.fmtNum(b.peserta)} peserta</small></td>
        ${showBooker ? `<td data-label="Pemohon">${U.esc(b.nama)}${b.kegiatan ? `<small class="sub">${U.esc(b.kegiatan)}</small>` : ""}</td>` : ""}
        <td data-label="Status">${U.badge(b.status)}</td>
      </tr>`;
      })
      .join("");

    root.innerHTML = `
      <h3 class="sched-title">Jadwal Peminjaman Aula Sekolah Tunas Dharma</h3>
      <p class="sched-date">${U.longDate(date)}</p>
      ${
        list.length
          ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Hari / Tanggal</th><th>Waktu</th><th>Ruangan</th>${showBooker ? "<th>Pemohon</th>" : ""}<th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="pager">
        <button type="button" class="btn ghost sm" data-page="-1" ${page === 0 ? "disabled" : ""}>« Sebelumnya</button>
        <span>${page + 1} / ${pages}</span>
        <button type="button" class="btn ghost sm" data-page="1" ${page >= pages - 1 ? "disabled" : ""}>Next »</button>
      </div>`
          : `<div class="empty"><strong>Belum ada jadwal</strong><span>Semua ruangan kosong pada tanggal ini.</span></div>`
      }`;
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (b && !b.disabled) {
      page += Number(b.dataset.page);
      render();
    }
  });

  render();
  return {
    setDate(d) {
      date = d;
      page = 0;
      render();
    },
    refresh: render,
    getDate: () => date,
  };
}
