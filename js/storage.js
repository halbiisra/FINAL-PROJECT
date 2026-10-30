/* RUMA — storage.js
 * Lapisan data (localStorage). Pemohon (guru), Admin TU, dan Admin Kepala Unit
 * membaca/menulis data yang SAMA, sehingga ketiganya otomatis berhubungan.
 * Perubahan dari tab lain terdeteksi lewat event "storage" (Store.onChange).
 * Sesi login disimpan di sessionStorage agar beberapa peran bisa dibuka
 * bersamaan di tab berbeda.
 *
 * Peran akun:
 *   role 'client' + type 'guru'   -> Pemohon (guru)
 *   role 'admin'  + type 'tu'     -> Admin TU
 *   role 'admin'  + type 'kepala' -> Admin Kepala Unit
 * Status permohonan: menunggu -> diteruskan -> disetujui | ditolak ; dibatalkan (oleh pemohon). */
const Store = (() => {
  const K = {
    users: 'ruma.users', rooms: 'ruma.rooms', bookings: 'ruma.bookings',
    mails: 'ruma.mails', notifs: 'ruma.notifs', seeded: 'ruma.seed.v3',
  };
  const SESSION = 'ruma.session';

  const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function seed() {
    if (read(K.seeded, false)) return;
    const now = Date.now();
    const t = U.today();

    /* Akun TU & Kepala Unit dibuat saat penyiapan sistem; pemohon mendaftar sendiri. */
    write(K.users, [
      { id: 'u-tu', role: 'admin', type: 'tu', name: 'Rina Marlina (TU)', username: 'tu', email: 'tu@tunasdharma.sch.id', password: 'tu123', idNo: '', phone: '', unit: 'Tata Usaha / Umum', active: true },
      { id: 'u-kepala', role: 'admin', type: 'kepala', name: 'Hendra Wijaya, S.Pd (Kepala Unit)', username: 'kepala', email: 'kepala@tunasdharma.sch.id', password: 'kepala123', idNo: '', phone: '', unit: 'Tata Usaha / Umum', active: true },
      { id: 'u-sari', role: 'client', type: 'guru', name: 'Sari Wulandari, S.Pd', username: 'guru', email: 'sari@tunasdharma.sch.id', password: 'guru123', idNo: '1978051220', phone: '', unit: 'SMP', active: true },
      { id: 'u-budi', role: 'client', type: 'guru', name: 'Budi Santoso, S.Pd', username: 'budi', email: 'budi@tunasdharma.sch.id', password: 'budi123', idNo: '1985010112', phone: '', unit: 'SD', active: true },
    ]);

    write(K.rooms, [
      { id: 'aula', name: 'Aula', capacity: 150, defaultCapacity: 150, seats: 150 },
    ]);

    const mk = (o) => Object.assign({
      id: U.uid('b-'), code: U.bookingCode(), note: '', createdAt: now, kegiatan: '', phone: '', doc: null,
      tuNote: '', seatsPrepared: null, forwardedAt: null, forwardedBy: '', decidedAt: null, decidedBy: '', alasan: '', cancelledAt: null,
    }, o);
    const day = 86400000;
    write(K.bookings, [
      mk({ userId: 'u-budi', nama: 'Budi Santoso, S.Pd', idNo: '1985010112', unit: 'SD', startDate: U.addDays(t, -14), endDate: U.addDays(t, -14), startTime: '09:00', endTime: '10:00', roomId: 'aula', peserta: 80, kegiatan: 'Rapat Orang Tua Murid', status: 'disetujui', createdAt: now - 20 * day, forwardedAt: now - 19 * day, forwardedBy: 'Rina Marlina (TU)', tuNote: 'Aula siap, kursi ditata model teater.', seatsPrepared: 80, decidedAt: now - 18 * day, decidedBy: 'Hendra Wijaya, S.Pd (Kepala Unit)' }),
      mk({ userId: 'u-sari', nama: 'Sari Wulandari, S.Pd', idNo: '1978051220', unit: 'SMP', startDate: U.addDays(t, 2), endDate: U.addDays(t, 2), startTime: '13:00', endTime: '15:00', roomId: 'aula', peserta: 140, kegiatan: 'Gladi Wisuda', status: 'disetujui', createdAt: now - 6 * day, forwardedAt: now - 5 * day, forwardedBy: 'Rina Marlina (TU)', tuNote: 'Aula siap, 150 kursi disiapkan.', seatsPrepared: 150, decidedAt: now - 4 * day, decidedBy: 'Hendra Wijaya, S.Pd (Kepala Unit)' }),
      mk({ userId: 'u-budi', nama: 'Budi Santoso, S.Pd', idNo: '1985010112', unit: 'SD', startDate: U.addDays(t, 3), endDate: U.addDays(t, 4), startTime: '08:00', endTime: '12:00', roomId: 'aula', peserta: 100, kegiatan: 'Workshop Kurikulum', status: 'menunggu', createdAt: now - 2 * 3600000 }),
      mk({ userId: 'u-sari', nama: 'Sari Wulandari, S.Pd', idNo: '1978051220', unit: 'SMP', startDate: U.addDays(t, 6), endDate: U.addDays(t, 6), startTime: '09:00', endTime: '11:00', roomId: 'aula', peserta: 120, kegiatan: 'Orientasi Siswa Baru', status: 'diteruskan', createdAt: now - 1 * day, forwardedAt: now - 3600000, forwardedBy: 'Rina Marlina (TU)', tuNote: 'Aula tersedia, proyektor & sound system siap.', seatsPrepared: 130 }),
      mk({ userId: 'u-budi', nama: 'Budi Santoso, S.Pd', idNo: '1985010112', unit: 'SD', startDate: U.addDays(t, 9), endDate: U.addDays(t, 9), startTime: '10:00', endTime: '12:00', roomId: 'aula', peserta: 120, kegiatan: 'Lomba Pidato', status: 'ditolak', createdAt: now - 8 * day, forwardedAt: now - 7 * day, forwardedBy: 'Rina Marlina (TU)', tuNote: 'Aula tersedia.', seatsPrepared: 120, decidedAt: now - 6 * day, decidedBy: 'Hendra Wijaya, S.Pd (Kepala Unit)', alasan: 'Aula dipakai untuk kegiatan yayasan pada tanggal tersebut.' }),
    ]);
    write(K.mails, []);
    write(K.notifs, []);
    write(K.seeded, true);
  }

  const list = key => ({
    all: () => read(key, []),
    get: id => read(key, []).find(x => x.id === id) || null,
    add(item) { const a = read(key, []); a.push(item); write(key, a); return item; },
    update(id, patch) {
      const a = read(key, []); const i = a.findIndex(x => x.id === id);
      if (i < 0) return null;
      a[i] = Object.assign({}, a[i], patch); write(key, a); return a[i];
    },
    remove(id) { write(key, read(key, []).filter(x => x.id !== id)); },
  });

  const users = Object.assign(list(K.users), {
    byLogin(v) {
      const q = String(v || '').trim().toLowerCase();
      return read(K.users, []).find(u => u.username.toLowerCase() === q || u.email.toLowerCase() === q) || null;
    },
    /* Semua admin dengan jenis tertentu ('tu' / 'kepala') yang masih aktif */
    admins: type => read(K.users, []).filter(u => u.role === 'admin' && u.type === type && u.active !== false),
  });
  const rooms = list(K.rooms);
  const bookings = list(K.bookings);
  const mails = list(K.mails);
  const notifs = list(K.notifs);

  const session = {
    get() { try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch (e) { return null; } },
    set(u) { sessionStorage.setItem(SESSION, JSON.stringify({ id: u.id })); },
    clear() { sessionStorage.removeItem(SESSION); },
  };

  function onChange(cb) {
    window.addEventListener('storage', e => { if (e.key && e.key.startsWith('ruma.')) cb(e.key); });
  }

  return { seed, users, rooms, bookings, mails, notifs, session, onChange };
})();
