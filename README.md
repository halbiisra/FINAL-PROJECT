# RUMA — Sistem Informasi Peminjaman Aula Sekolah Tunas Dharma
HTML + CSS + JavaScript murni, tanpa build/instalasi. Responsif untuk HP, tablet, dan desktop.

## Cara menjalankan
Buka `index.html` di browser, atau lewat server lokal:
`python3 -m http.server 8000` lalu buka http://localhost:8000

## Peran & akun contoh
| Peran | Username | Password | Halaman |
|---|---|---|---|
| Admin TU | `tu` | `tu123` | `admin.html` |
| Admin Kepala Unit | `kepala` | `kepala123` | `admin.html` |
| Pemohon (Guru) | `guru` / `budi` | `guru123` / `budi123` | `client.html` |

**TU dan Kepala Unit sama-sama berperan `admin`, tetapi hak aksesnya berbeda sesuai tugas:**

| Fitur | Admin TU | Admin Kepala Unit |
|---|---|---|
| Kalender & jadwal aula, notifikasi, edit profil, ubah sandi | ✔ | ✔ |
| Lihat semua permohonan | ✔ | — (hanya yang diteruskan TU) |
| Periksa dokumen pendukung | ✔ | ✔ (buka dokumen) |
| Catat kesiapan aula & jumlah kursi, teruskan ke Kepala Unit | ✔ | — |
| Ubah data aula (nama, kapasitas, kursi) | ✔ | — |
| Kelola akun pemohon (tambah, ubah, nonaktifkan) | ✔ | — |
| Setujui / tolak (alasan wajib), validasi ulang bentrok | — | ✔ |
| Rekap peminjaman (periode & unit), unduh CSV | — | ✔ |

Akun TU dan Kepala Unit dibuat saat penyiapan sistem (lihat `js/storage.js`). Pemohon mendaftar sendiri lewat tab **Daftar** (pilih unit; NIDN 8–10 angka).

## Alur status permohonan
`Menunggu` (pemohon mengajukan, TU diberi notifikasi) → `Diteruskan` (TU, Kepala Unit diberi notifikasi) → `Disetujui` atau `Ditolak` (Kepala Unit; waktu keputusan dicatat dalam WIB).
Pemohon dapat **membatalkan** selama status Menunggu/Diteruskan → `Dibatalkan` (jadwal kembali tersedia, TU & Kepala Unit diberi notifikasi).

Aturan otomatis:
- Pengajuan yang jadwalnya bentrok atau pesertanya melebihi kapasitas ditolak otomatis dan **tidak disimpan**.
- Nama kegiatan **wajib** diisi. Dokumen pendukung **opsional**: PDF/JPG/PNG/DOC/DOCX, maksimal 2 MB.
- Saat status menjadi Disetujui, Ditolak, atau Dibatalkan, pemohon mendapat notifikasi aplikasi **dan** email (simulasi, tampil di Kotak Email).

## Struktur file
```
index.html / client.html / admin.html
assets/logo.svg   Logo RUMA (dipakai semua halaman + favicon)
css/  base, motion (animasi & navigasi), login, calendar, client, admin
js/
  utils.js     Helper (tanggal, status, unit, aturan NIDN & dokumen, deteksi bentrok)
  storage.js   Data localStorage + seed (akun, aula, contoh permohonan)
  auth.js      Login, registrasi, edit profil, ubah sandi, penjaga halaman
  flow.js      Alur status: ajukan, teruskan, setujui, tolak, batalkan
  notify.js    Notifikasi dalam aplikasi
  mailer.js    Simulasi email
  account.js   Modal Edit Profil & Ubah Kata Sandi
  calendar.js, schedule.js, ui.js
  login.js, client.js, admin.js
```

## Fitur akun
- **Edit profil** hanya mengubah **nama lengkap**, **No. HP** (opsional), dan **foto profil** (JPG/PNG/WEBP, otomatis dipotong persegi & dikecilkan). Username & email (serta NIDN & unit pemohon) cukup ditetapkan sekali saat daftar, jadi hanya tampil dan tidak bisa diubah.
- **Data pemohon terkunci**: Nama, NIDN, dan unit di formulir peminjaman otomatis mengikuti akun dan tidak bisa diedit saat booking.
- Semua kolom password punya ikon mata (buka = tampilkan, tutup = sembunyikan).

## Catatan
- Data tersimpan di **localStorage browser** (demo, tanpa server); tidak berpindah antar perangkat. Untuk pemakaian nyata perlu backend + database.
- Password disimpan apa adanya — hanya untuk demo.
- Email bersifat simulasi; pengiriman sungguhan butuh server.
