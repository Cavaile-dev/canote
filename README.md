# Canote

Canote adalah aplikasi desktop Windows untuk merekam kuliah, membuat transkrip lokal, dan menyusun ringkasan belajar dengan API AI. Dibangun dari [OpenWhispr](https://github.com/OpenWhispr/openwhispr), dengan fokus pada kuliah berbahasa Indonesia yang bercampur istilah Inggris.

**[Unduh Canote untuk Windows](https://github.com/Cavaile-dev/canote/releases/latest)** · [Laporkan masalah](https://github.com/Cavaile-dev/canote/issues)

Link unduhan tersedia setelah rilis pertama dipublikasikan. Rilis berstatus Draft belum dapat diunduh publik atau ditemukan oleh updater.

## Fitur

- **Smart Note:** rekam melalui mikrofon atau impor file lewat ikon upload di samping mic.
- **Transkrip lokal:** gunakan Whisper multilingual, termasuk varian Turbo dan Q5 yang tersedia di pemilih model. Audio untuk transkripsi lokal diproses di komputer.
- **Ringkasan:** topik, penjelasan, istilah penting, contoh, kesimpulan, dan highlight dari transkrip.
- **Tugas, Quiz, dan Ulangan:** deteksi pengumuman dosen beserta jadwal dan kisi-kisi yang disebutkan. Kandidat AI bisa diedit, dikonfirmasi, dibatalkan, atau ditandai selesai.
- **Daftar gabungan:** lihat item dari semua note, diurutkan berdasarkan tanggal note dibuat, terbaru terlebih dahulu.
- **Calender:** pilih tanggal untuk melihat dan membuka note yang dibuat pada hari itu.
- **Tema putih-pink:** tampilan sederhana dengan tanggal, tahun, dan waktu pembuatan note.
- **Setup awal:** Selamat datang → Mikrofon → Model transkrip lokal → API ringkasan → Selesai. Tidak memerlukan akun Canote.

Deteksi AI tetap perlu diperiksa. Tanggal yang tidak disebutkan tidak ditebak, dan kutipan bukti dicocokkan dengan transkrip. Tombol **Buat ulang** memakai transkrip note, termasuk untuk menyusun ulang daftar Tugas, Quiz, dan Ulangan.

## Mulai menggunakan

1. Instal Canote dari halaman [Releases](https://github.com/Cavaile-dev/canote/releases).
2. Ikuti setup awal dan unduh model Whisper. Small adalah pilihan awal; pilih ukuran model sesuai kemampuan komputer.
3. Izinkan akses mikrofon, atau pilih **Atur nanti** jika hanya ingin mengimpor file.
4. Pilih provider dan model API untuk ringkasan. Endpoint OpenAI-compatible dapat diatur sebagai Custom Provider atau Self-Hosted.
5. Buat note di Smart Note, lalu gunakan ikon mic atau upload. Ringkasan dibuat setelah rekaman/transkripsi selesai jika API sudah dikonfigurasi.

Mikrofon dan API bisa diatur nanti melalui Settings. Model transkrip harus tersedia sebelum setup selesai. Transkrip muncul bertahap sesuai proses model dan kemampuan perangkat.

## Data dan API key

Note dan hasil analisis disimpan di database lokal. Untuk membuat ringkasan, **teks transkrip dikirim ke provider API pilihan pengguna**; biaya dan ketentuan mengikuti provider tersebut. Transkripsi lokal memakai model gratis, sedangkan layanan LLM dapat berbayar.

Masukkan API key melalui aplikasi. Key disimpan melalui penyimpanan kredensial sistem; jangan menuliskannya ke source code. Repo dan paket distribusi mengecualikan `.env*`, database lokal, berkas key, folder kredensial, log, dan data profil.

Build menjalankan pemeriksaan isi paket sebelum membuat installer. `npm run check:secrets` memeriksa file yang akan dipublikasikan tanpa mencetak nilai kredensial. Deteksi pola merupakan pemeriksaan tambahan; tetap tinjau perubahan sebelum commit.

## Pengembangan

Memerlukan **Node.js 24+**, npm, dan Windows untuk membangun installer Windows.

```powershell
git clone https://github.com/Cavaile-dev/canote.git
cd canote
npm ci
npm run dev
```

Development pertama mengunduh sejumlah helper native. Tidak perlu membuat `.env` atau memasukkan API key pribadi untuk membangun aplikasi.

Untuk menjalankan renderer yang sudah dibuild:

```powershell
npm run build:renderer
node scripts/run-electron.js
```

Untuk pemeriksaan source dan logika utama:

```powershell
npm run check:secrets
npm run typecheck
npm run test:canote
npm run build:renderer
```

`test:canote` menjalankan tes terfokus untuk updater, setup, analisis kuliah, pengurutan, kalender, dan perlindungan file publik. Ini bukan pengganti pengujian seluruh suite, mikrofon, atau UI secara langsung.

## Build installer Windows

```powershell
npm run build:win -- --config electron-builder.unsigned-win.json --x64 --publish never
```

Hasil ada di `dist/`, termasuk installer `Canote-Setup-<versi>-x64.exe`, blockmap, dan `latest.yml`. Helper native dapat diunduh pada build pertama. Model Whisper diunduh pengguna saat setup, sehingga tidak perlu memasukkan model pribadi ke repo.

Build standar belum memakai sertifikat code signing. Windows dapat menampilkan peringatan penerbit tidak dikenal. Konfigurasi signing OpenWhispr tidak dipakai oleh Canote.

## Rilis dan pembaruan aplikasi

Updater aplikasi Windows yang sudah diinstal memakai **GitHub Releases di `Cavaile-dev/canote`**. Aplikasi yang dijalankan dari source tidak memasang pembaruan ke folder kerja.

Untuk menyiapkan rilis baru:

```powershell
npm version patch
git push origin main --follow-tags
```

`npm version patch` memperbarui versi package dan membuat tag, misalnya `v1.11.1`. Tag harus cocok dengan `package.json`.

Workflow **Canote Windows Release** kemudian:

1. Memeriksa source, tipe, dan tes logika Canote.
2. Membuat installer Windows tanpa membundel `.env` atau API key.
3. Mengunggah installer, blockmap, dan `latest.yml` ke sebuah **Draft Release**.

Workflow juga dapat dijalankan melalui **Actions → Canote Windows Release → Run workflow**. Workflow hanya memakai token sementara bawaan GitHub, dengan izin menulis isi repo; tidak membutuhkan API key LLM atau kredensial signing OpenWhispr.

Periksa draft dan installer, lalu klik **Publish release** di GitHub. Setelah rilis stabil dipublikasikan, Canote versi lama dapat menemukan versi yang lebih baru, menampilkan **Update available**, mengunduh installer, lalu memasangnya saat restart. Jangan menghapus atau mengubah installer dan metadata pada rilis yang sudah dipublikasikan; buat versi baru untuk perbaikan.

Pemeriksaan pembaruan berjalan saat aplikasi mulai dan secara berkala. Unduhan otomatis mengikuti pilihan pengguna di Settings; jika dimatikan, pengguna tetap bisa memilih unduhan secara manual.

## Lisensi dan kredit

Canote menggunakan [lisensi MIT](LICENSE). Hak cipta dan atribusi OpenWhispr dipertahankan. Source desktop lintas platform dan beberapa komponen lama masih berasal dari upstream; pengembangan dan rilis Canote pada repo ini berfokus pada Windows.

Workflow upstream disimpan sebagai referensi di `docs/upstream-workflows/` dan tidak dieksekusi oleh GitHub Actions repo ini.

Made with love -Pipin
