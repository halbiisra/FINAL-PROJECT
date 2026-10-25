/* RUMA — utils.js
 * Fungsi bantu murni: tanggal, waktu, format teks, deteksi bentrok jadwal. */
const U = (() => {
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const STATUS = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };
  const OPEN_HOUR = '07:00';
  const CLOSE_HOUR = '21:00';

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const longDate = s => { const d = parse(s); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MON_S[d.getMonth()]} ${d.getFullYear()}`; };
  const rangeLabel = (a, b) => (a === b ? longDate(a) : `${longDate(a)} – ${longDate(b)}`);
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const timeRange = b => `${b.startTime.replace(':', '.')} - ${b.endTime.replace(':', '.')}`;
  const fmtNum = n => Number(n).toLocaleString('id-ID');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const badge = s => `<span class="badge ${s}">${STATUS[s] || s}</span>`;
  const uid = p => p + Math.random().toString(36).slice(2, 8);
  const bookingCode = () => 'RM-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const timeAgo = ts => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    return Math.floor(s / 86400) + ' hari lalu';
  };

  /* Dua pemesanan bentrok bila ruangnya sama, rentang tanggal beririsan,
   * dan jam harian beririsan. Jam selesai = jam mulai berikutnya TIDAK bentrok. */
  const datesOverlap = (a, b) => a.startDate <= b.endDate && b.startDate <= a.endDate;
  const timesOverlap = (a, b) => toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime);
  function findConflict(candidate, all, statuses, ignoreId) {
    return all.find(x =>
      x.id !== ignoreId &&
      statuses.includes(x.status) &&
      x.roomId === candidate.roomId &&
      datesOverlap(x, candidate) &&
      timesOverlap(x, candidate)) || null;
  }

  function mailto(to, subject, body) {
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function idLabel(type) {
    if (type === 'mahasiswa') return 'NIM';
    if (type === 'external') return 'No. Identitas (KTP)';
    return 'NIP';
  }
  const typeLabel = t => ({ mahasiswa: 'Mahasiswa', dosen: 'Dosen', staf: 'Staf', external: 'External' }[t] || t);

  return {
    DAYS, MONTHS, MON_S, STATUS, OPEN_HOUR, CLOSE_HOUR,
    pad, iso, parse, today, addDays, longDate, rangeLabel, toMin, timeRange, fmtNum, esc, badge, uid, bookingCode, timeAgo,
    datesOverlap, timesOverlap, findConflict, mailto, idLabel, typeLabel,
  };
})();
