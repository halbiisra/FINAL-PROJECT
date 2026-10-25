/* RUMA — storage.js
 * Lapisan data (localStorage). Admin dan client membaca/menulis data yang SAMA,
 * sehingga keduanya otomatis berhubungan. Perubahan dari tab lain terdeteksi
 * lewat event "storage" (Store.onChange).
 * Sesi login disimpan di sessionStorage agar admin & client bisa dibuka
 * bersamaan di tab berbeda. */
const Store = (() => {
  const K = {
    users: 'ruma.users', rooms: 'ruma.rooms', bookings: 'ruma.bookings',
    mails: 'ruma.mails', seeded: 'ruma.seed.v1',
  };
  const SESSION = 'ruma.session';

  const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function seed() {
    if (read(K.seeded, false)) return;
    const now = Date.now();
    const t = U.today();

    write(K.users, [
      { id: 'u-admin', role: 'admin', type: 'staf', name: 'Admin RUMA', username: 'admin', email: 'admin@ruma.ac.id', password: 'admin123', idNo: '198001012005011001', phone: '' },
      { id: 'u-budi', role: 'client', type: 'mahasiswa', name: 'Budi Santoso', username: 'budi', email: 'budi@mahasiswa.ac.id', password: 'budi123', idNo: '2210511001', phone: '' },
      { id: 'u-sari', role: 'client', type: 'dosen', name: 'Dr. Sari Wulandari', username: 'dosen', email: 'sari@dosen.ac.id', password: 'dosen123', idNo: '197805122003122002', phone: '' },
    ]);

    write(K.rooms, [
      { id: 'aula', name: 'Aula', capacity: 150, defaultCapacity: 150 },
      { id: 'auditorium', name: 'Auditorium', capacity: 400, defaultCapacity: 400 },
    ]);

    const mk = (o) => Object.assign({ id: U.uid('b-'), code: U.bookingCode(), note: '', createdAt: now, kegiatan: '', phone: '' }, o);
    write(K.bookings, [
      mk({ userId: 'u-budi', nama: 'Budi Santoso', idNo: '2210511001', startDate: '2026-10-16', endDate: '2026-10-16', startTime: '09:00', endTime: '10:00', roomId: 'aula', peserta: 80, kegiatan: 'Seminar Proposal', status: 'disetujui' }),
      mk({ userId: 'u-sari', nama: 'Dr. Sari Wulandari', idNo: '197805122003122002', startDate: '2026-10-16', endDate: '2026-10-16', startTime: '10:30', endTime: '12:00', roomId: 'auditorium', peserta: 250, kegiatan: 'Rapat Dosen', status: 'disetujui' }),
      mk({ userId: 'u-sari', nama: 'Dr. Sari Wulandari', idNo: '197805122003122002', startDate: U.addDays(t, 2), endDate: U.addDays(t, 2), startTime: '13:00', endTime: '15:00', roomId: 'auditorium', peserta: 300, kegiatan: 'Gladi Wisuda', status: 'disetujui' }),
      mk({ userId: 'u-budi', nama: 'Budi Santoso', idNo: '2210511001', startDate: U.addDays(t, 3), endDate: U.addDays(t, 4), startTime: '08:00', endTime: '12:00', roomId: 'aula', peserta: 100, kegiatan: 'Workshop UI/UX', status: 'menunggu' }),
      mk({ userId: 'u-budi', nama: 'Budi Santoso', idNo: '2210511001', startDate: U.addDays(t, 7), endDate: U.addDays(t, 7), startTime: '09:00', endTime: '11:00', roomId: 'aula', peserta: 120, kegiatan: 'Orientasi Organisasi', status: 'disetujui' }),
    ]);
    write(K.mails, []);
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
  });
  const rooms = list(K.rooms);
  const bookings = list(K.bookings);
  const mails = list(K.mails);

  const session = {
    get() { try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch (e) { return null; } },
    set(u) { sessionStorage.setItem(SESSION, JSON.stringify({ id: u.id })); },
    clear() { sessionStorage.removeItem(SESSION); },
  };

  function onChange(cb) {
    window.addEventListener('storage', e => { if (e.key && e.key.startsWith('ruma.')) cb(e.key); });
  }

  return { seed, users, rooms, bookings, mails, session, onChange };
})();
