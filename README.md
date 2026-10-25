# RUMA — Ruang Untuk Meeting dan Acara
*Temukan ruang untuk rencanamu!*

Aplikasi web peminjaman Aula 1 & Auditorium kampus. HTML + CSS + JavaScript murni, tanpa build/instalasi.
Responsif untuk HP, tablet, dan desktop.

## Cara menjalankan
Buka `index.html` di browser, atau lebih baik lewat server lokal:
`python3 -m http.server 8000` lalu buka http://localhost:8000

## Akun contoh
| Peran | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Mahasiswa | `budi` | `budi123` |
| Dosen | `dosen` | `dosen123` |

Pengguna baru bisa **Daftar** (Mahasiswa / Dosen / External — External wajib mengisi No. HP).

## Alur login → mode
- Login sebagai **admin** → langsung masuk `admin.html` (Mode Admin).
- Login sebagai **client** → langsung masuk `client.html` (Mode Client).
- Admin bisa pindah ke Mode Client lewat tombol di header, dan kembali lagi.

## Keterhubungan admin ↔ client
Keduanya memakai data yang sama. Buka admin di satu tab dan client di tab lain:
- Client submit → admin langsung dapat notifikasi & badge "Permintaan" bertambah.
- Admin setujui/tolak → client langsung dapat notifikasi, status di Riwayat berubah, dan email masuk ke Kotak Email.
- Admin ubah kapasitas aula (slider) → slider di formulir client ikut menyesuaikan batas maksimumnya.

## Fitur kapasitas (mode slider)
- **Client**: slider jumlah peserta di formulir, batas maksimum = kapasitas ruangan terpilih, ada meter persentase.
- **Admin**: tab *Kapasitas Aula*, slider 10–1000 per ruangan, tombol Simpan dan "Kembali ke standar", ada peringatan jika ada peminjaman yang melebihi kapasitas baru.

## Struktur file (dipisah sesuai tugas)
```
index.html        Halaman login / daftar
client.html       Mode client
admin.html        Mode admin
css/
  base.css        Token desain, tombol, form, slider, tabel, toast, modal
  login.css       Halaman login
  calendar.css    Kalender & tabel jadwal (dipakai bersama)
  client.css      Formulir, terima kasih, riwayat, email
  admin.css       Ringkasan, filter, kapasitas
js/
  utils.js        Helper tanggal/waktu, format, deteksi bentrok
  ui.js           Toast, modal, konfirmasi
  storage.js      Data (localStorage) + seed + sinkron antar tab
  auth.js         Login, daftar, penjaga halaman per peran
  mailer.js       Simulasi email + tautan mailto
  calendar.js     Komponen kalender bulanan
  schedule.js     Tabel jadwal dengan Next »
  login.js        Logika halaman login
  client.js       Logika mode client
  admin.js        Logika mode admin
```

## Catatan penting
- Data tersimpan di **localStorage browser** (demo, tanpa server). Data tidak berpindah antar perangkat; untuk dipakai bersama sungguhan perlu backend + database.
- Password disimpan apa adanya di localStorage — hanya untuk demo, **jangan** dipakai untuk produksi.
- Email bersifat simulasi: isi masuk ke tab *Kotak Email*, dan tombol "Kirim ke email" membuka aplikasi email lewat `mailto:`. Pengiriman email otomatis butuh server.
