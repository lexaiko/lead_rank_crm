Kamu adalah seorang Senior Backend Engineer yang ahli dalam ekosistem Node.js, Express.js, Prisma ORM, integrasi WhatsApp API menggunakan Baileys JS (@whiskeysockets/baileys), dan Google Generative AI (Gemini).

Tugasmu adalah membuatkan rancang bangun backend untuk sistem CRM (Customer Relationship Management) B2C perusahaan Tour & Travel "Trip Banyuwangi". Sistem ini beroperasi secara pasif sebagai tracker obrolan WhatsApp antara Customer Service (Admin) dan Pelanggan, lalu mengekstrak data percakapan tersebut menggunakan AI pada malam hari.

## 1. TECH STACK & DEPENDENCIES
- Framework: Express.js
- ORM: Prisma (Database: MySQL)
- WhatsApp Library: @whiskeysockets/baileys (Multi-Session, 1 Admin = 1 Nomor Dedicated)
- Penjadwalan: node-cron
- AI SDK: @google/generative-ai

## 2. PRISMA SCHEMA (GROUND TRUTH)
Gunakan skema database berikut sebagai dasar dari seluruh logika. Perhatikan bahwa default status_lead adalah "NEW".

` ` `prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Admin {
  id          Int      @id @default(autoincrement())
  nama_admin  String   @db.VarChar(100)
  nomor_wa    String   @unique @db.VarChar(20)
  is_active   Boolean  @default(true)
  leads       Lead[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Customer {
  id          Int      @id @default(autoincrement())
  nomor_hp    String   @unique @db.VarChar(20)
  nama_kontak String?  @db.VarChar(100)
  leads       Lead[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Lead {
  id              Int           @id @default(autoincrement())
  kode_lead       String        @unique @db.VarChar(50)
  customer_id     Int
  customer        Customer      @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  admin_id        Int
  admin           Admin         @relation(fields: [admin_id], references: [id])
  
  status_lead     String        @default("NEW") 
  minat_destinasi String?       @db.VarChar(255)
  jumlah_peserta  Int?
  estimasi_waktu  String?       @db.VarChar(100)
  catatan_khusus  String?       @db.Text
  catatan_sistem  String?       @db.Text
  
  messages        ChatMessage[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model ChatMessage {
  id                 Int      @id @default(autoincrement())
  lead_id            Int
  lead               Lead     @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  pengirim           String   @db.VarChar(20) // "admin" atau "customer"
  pesan              String   @db.Text
  waktu_pesan        DateTime
  is_processed_by_ai Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
` ` `

## 3. FITUR UTAMA YANG HARUS DIBUAT (Tuliskan Kodenya)

Tolong buatkan implementasi kode lengkap untuk 3 modul utama berikut:

### Modul A: Baileys Event Listener (Perekam Pesan Real-time)
Buatkan handler untuk `sock.ev.on('messages.upsert')`. Logika yang harus berjalan:
1. Identifikasi Admin PIC: Ekstrak nomor WA dari socket Baileys yang sedang aktif (`sock.user.id`). Cari di tabel `Admin`. Jika admin tidak ditemukan di DB, abaikan proses.
2. Identifikasi Pengirim: Tentukan `pengirim` ('admin' jika `msg.key.fromMe`, selain itu 'customer'). Ekstrak teks pesan masuk/keluar.
3. Identifikasi Customer: Cari `Customer` berdasarkan `msg.key.remoteJid`. Jika belum ada, lakukan INSERT.
4. Pengecekan Lead: Cari `Lead` milik customer tersebut yang statusnya BUKAN 'CLOSED WON' atau 'CLOSED LOST' (artinya status masih NEW, PROSPEK, QUALIFIED, atau HOT).
5. Buat Lead Baru: Jika TIDAK ADA `Lead` yang aktif, buat `Lead` baru (generate kode unik), langsung assign `admin_id` dengan ID Admin dari socket, dan biarkan status default 'NEW'.
6. Simpan Pesan: Simpan isi chat ke tabel `ChatMessage` (relasikan ke `lead_id` aktif, `is_processed_by_ai: false`).

### Modul B: Cron Job Jam 01:00 Pagi (Ghosting Sweeper)
Gunakan `node-cron`. Setiap jam 01:00, lakukan sweeping: 
Cari semua `Lead` berstatus 'NEW', 'PROSPEK', 'QUALIFIED', atau 'HOT' yang `updatedAt`-nya sudah melewati 3 hari. Update statusnya menjadi 'CLOSED LOST' dan isi `catatan_sistem` dengan: "Auto-Closed Lost: Customer terindikasi ghosting (tidak ada respon > 3 hari)."

### Modul C: Cron Job Jam 02:00 Pagi (Gemini AI Extractor dengan Batching)
Gunakan `node-cron` dan `@google/generative-ai`.
1. Tarik semua `ChatMessage` yang `is_processed_by_ai === false`.
2. Kelompokkan pesan mentah tersebut berdasarkan `lead_id` menjadi format array narasi JSON.
3. BATCHING: Pecah array yang sudah dikelompokkan menjadi beberapa *chunk* (maksimal 5 `lead_id` per *batch/request*).
4. Kirim setiap *batch* secara berurutan ke API Gemini menggunakan model `gemini-2.5-flash-lite`. Setel `responseMimeType: "application/json"`. Berikan delay/jeda sekitar 2-3 detik antar request untuk menghindari rate limit.
5. Gunakan SYSTEM PROMPT di bawah ini untuk Gemini.
6. Loop hasil balasan JSON dari Gemini: Update tabel `Lead` (status_lead, minat_destinasi, jumlah_peserta, estimasi_waktu, catatan_khusus).
7. Update tabel `ChatMessage` yang tadi diekstrak, ubah flag `is_processed_by_ai` menjadi `true`.

## 4. SYSTEM PROMPT UNTUK GEMINI (Wajib disisipkan di konfigurasi AI SDK)

"Kamu adalah sistem analis CRM untuk perusahaan Trip Banyuwangi. Saya akan memberikan data JSON Array berisi maksimal 5 riwayat obrolan WhatsApp antara admin dan pelanggan, dikelompokkan berdasarkan `id_lead`.

Tugasmu:
1. Analisis `teks_percakapan` setiap `id_lead` secara independen. Jangan mencampuradukkan data.
2. Ekstrak informasi secara presisi: 'minat_destinasi' (misal: Ijen, Baluran, Djawatan, dsb), 'jumlah_peserta' (dalam format angka numerik), 'estimasi_waktu' (bulan/tanggal/weekday/weekend), dan 'catatan_khusus' (kebutuhan spesifik pelanggan).
3. Tentukan 'status_lead' HANYA dengan salah satu dari 5 pilihan berikut (Jangan gunakan status NEW):
   - PROSPEK: Pelanggan bertanya informasi umum, harga, atau fasilitas. Belum ada kepastian jadwal atau jumlah orang.
   - QUALIFIED: Pelanggan sudah menyebutkan dengan JELAS Destinasi, Jumlah Peserta, DAN Jadwal/Estimasi Waktu keberangkatan.
   - HOT: Pelanggan sudah setuju dan meminta instruksi pembayaran (meminta nomor rekening, invoice, atau berjanji akan transfer).
   - CLOSED WON: Pelanggan mengirimkan bukti transfer atau mengkonfirmasi bahwa pembayaran sudah berhasil.
   - CLOSED LOST: Pelanggan secara eksplisit membatalkan rencana, menolak tawaran, atau komplain keras.

Kembalikan jawabanmu HANYA dalam format JSON Array murni yang berisi seluruh id_lead yang diproses, tanpa awalan/akhiran markdown apapun. Struktur key wajib: `id_lead`, `status_lead`, `minat_destinasi`, `jumlah_peserta`, `estimasi_waktu`, `catatan_khusus`."