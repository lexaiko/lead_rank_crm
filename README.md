# Trip Banyuwangi - Leads Intelligence CRM

Sistem Manajemen Hubungan Pelanggan (CRM) berbasis WhatsApp & Kecerdasan Buatan (Gemini AI) untuk otomatisasi kualifikasi leads, tracking pesan, dan analisis respon admin untuk bisnis Trip Banyuwangi.

## 🚀 Fitur Utama
* **WhatsApp Integration (Baileys)**: Koneksi multi-session admin CS langsung dengan WhatsApp Web socket.
* **Auto-Correction & Phonebook Mapping**: Otomatis memetakan LID WhatsApp ke Nomor HP asli dan menyinkronkan nama kontak dari buku telepon ponsel.
* **AI Extraction (Gemini AI)**: Mengekstrak tujuan wisata, jumlah peserta, tanggal keberangkatan, nilai pesanan, referensi, serta catatan khusus dari chat secara otomatis.
* **Leads Classification (KPI & Pipeline)**: Mengelompokkan status lead secara cerdas (`PROSPEK`, `QUALIFIED`, `HOT`, `CLOSED WON`, `CLOSED LOST`).
* **Ghosting Sweeper**: Secara otomatis menutup (auto-close) leads yang tidak merespon/tanpa aktivitas selama lebih dari 3 hari.
* **Response Time Analytics**: Menghitung rata-rata waktu respon setiap admin CS secara real-time untuk KPI performa kerja.

---

## 🛠️ Prasyarat (Prerequisites)
Sebelum memulai instalasi, pastikan sistem Anda telah terpasang:
1. **Node.js** (v18 ke atas) & **npm**.
2. **MySQL Database Server** (aktif berjalan di lokal atau cloud).
3. **Google Gemini API Key** (dapatkan secara gratis melalui [Google AI Studio](https://aistudio.google.com/)).
4. **Perangkat HP dengan WhatsApp Aktif** untuk pemindaian QR Code.

---

## 💻 Langkah Instalasi & Setup awal

### 1. Clone & Buka Repositori Project
Buka terminal/command prompt Anda, lalu masuk ke folder project:
```bash
cd c:/coding/TripBwi/classifier
```

### 2. Pasang Dependencies Node.js
Jalankan perintah berikut untuk mengunduh seluruh package/library yang dibutuhkan:
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Salin file template `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` baru tersebut, lalu sesuaikan isinya:
```env
# URL Koneksi Database MySQL Anda
DATABASE_URL="mysql://username:password@localhost:3306/nama_database"

# API Key Google Gemini untuk Ekstraksi AI
GEMINI_API_KEY="AIzaSy..."

# Port server berjalan
PORT=3002

# Level Log WhatsApp Baileys (pilihan: silent, info, debug, trace)
BAILEYS_LOG_LEVEL=silent
```

### 4. Setup Database & Jalankan Migrasi Prisma
Buat tabel-tabel database yang diperlukan secara otomatis dengan menjalankan migrasi Prisma:
```bash
npx prisma migrate dev --name init
```
*Perintah ini akan membaca skema di `prisma/schema.prisma` dan menyinkronkan tabel-tabel MySQL Anda.*

### 5. Jalankan Server Development
Jalankan server dalam mode development (menggunakan `nodemon` agar otomatis reload setiap ada perubahan kode):
```bash
npm run dev
```
Jika sukses, terminal akan menampilkan output:
```text
=========================================
Trip Banyuwangi CRM Backend is running!
Port: 3002
Dashboard: http://localhost:3002/api/dashboard-html
=========================================
```

---

## 🖥️ Cara Penggunaan & Hubungkan WhatsApp

1. Buka browser Anda dan kunjungi halaman Dashboard Console:
   **[http://localhost:3002/api/dashboard-html](http://localhost:3002/api/dashboard-html)**
2. **Daftarkan Admin CS**:
   * Scroll ke bagian **Admin CS Accounts** di sidebar atau halaman bawah.
   * Klik tombol registrasi / tambahkan Admin baru dengan memasukkan **Nama Admin** dan **Nomor WhatsApp** (gunakan format kode negara lengkap, misal `628123456789`).
3. **Hubungkan Sesi WhatsApp**:
   * Klik tombol **Connect / QR** di samping akun Admin yang baru saja Anda buat.
   * Sebuah jendela modal (popup) berisi QR Code akan muncul di layar.
   * Buka WhatsApp di HP Anda, buka **Perangkat Tertaut (Linked Devices)**, lalu pindai (scan) QR Code tersebut.
4. **Selesai!**
   * Sesi otentikasi akan tersimpan otomatis di dalam folder `sessions/`.
   * Sistem akan mulai menyinkronkan kontak, riwayat obrolan, kualifikasi AI Gemini, dan menghitung statistik waktu respon secara real-time.
