/* RUMA — utils.js
 * Fungsi bantu murni: tanggal, waktu, format teks, deteksi bentrok jadwal. */
const U = (() => {
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const STATUS = { menunggu: 'Menunggu', diteruskan: 'Diteruskan', disetujui: 'Disetujui', ditolak: 'Ditolak', dibatalkan: 'Dibatalkan' };
  /* Status yang tidak lagi memakai jadwal (slot kembali tersedia di kalender) */
  const INACTIVE = ['ditolak', 'dibatalkan'];
  /* Status yang masih dalam proses (belum diputuskan) */
  const PENDING = ['menunggu', 'diteruskan'];
  const UNITS = ['TK', 'SD', 'SMP', 'SMA', 'Tata Usaha / Umum'];
  /* Nomor identitas guru (NIDN): hanya angka, 8–10 digit */
  const ID_RULE = { min: 8, max: 10 };
  /* Unggahan dokumen pendukung */
  const DOC_RULE = { maxBytes: 2 * 1024 * 1024, exts: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'] };
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

  const idLabel = () => 'NIDN';
  const typeLabel = t => ({ guru: 'Guru', tu: 'Admin TU', kepala: 'Admin Kepala Unit' }[t] || t);
  const wib = ts => new Date(ts).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') + ' WIB';
  const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  /* Baca file unggahan jadi objek dokumen {name,type,size,data} (data = data URL) */
  function readDoc(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: r.result });
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  /* Foto profil: baca gambar, potong persegi, kecilkan ke 256px (JPEG) agar hemat localStorage */
  const PHOTO_RULE = { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'], size: 256 };
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!PHOTO_RULE.types.includes(file.type)) { reject(new Error('Foto harus berformat JPG, PNG, atau WEBP.')); return; }
      if (file.size > PHOTO_RULE.maxBytes) { reject(new Error('Ukuran foto maksimal 5 MB.')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = c.height = PHOTO_RULE.size;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, PHOTO_RULE.size, PHOTO_RULE.size);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak dapat dibaca. Coba file lain.')); };
      img.src = url;
    });
  }

  /* Buka dokumen di tab baru (lewat Blob, karena data: URL diblokir browser) */
  function openDoc(doc) {
    const [head, b64] = doc.data.split(',');
    const mime = (head.match(/data:(.*?);base64/) || [])[1] || doc.type || 'application/octet-stream';
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    const w = window.open(url, '_blank');
    if (!w) { const a = document.createElement('a'); a.href = url; a.download = doc.name; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return {
    DAYS, MONTHS, MON_S, STATUS, INACTIVE, PENDING, UNITS, ID_RULE, DOC_RULE, OPEN_HOUR, CLOSE_HOUR,
    pad, iso, parse, today, addDays, longDate, rangeLabel, toMin, timeRange, fmtNum, esc, badge, uid, bookingCode, timeAgo,
    datesOverlap, timesOverlap, findConflict, mailto, idLabel, typeLabel, wib, fmtSize, readDoc, readImage, openDoc,
  };
})();
