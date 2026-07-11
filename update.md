Saya ingin melakukan refactor arsitektur CRM WhatsApp Travel saya.

Project menggunakan:
- Node.js
- Prisma ORM
- MySQL

Tujuan:
Membangun sistem CRM yang scalable dengan AI Lead Analysis menggunakan LLM.

Fokus utama:
- Customer dapat memiliki banyak Lead (repeat order support)
- Chat WhatsApp tersimpan sebagai histori utama
- AI melakukan analisis secara asynchronous menggunakan queue
- AI tidak menganalisis setiap bubble chat
- AI menggunakan debounce 15 menit
- AI melakukan bulk processing 5-10 Lead dalam satu request
- AI menggunakan incremental context agar hemat token
- Output AI berupa JSON yang mudah dipakai backend


====================================================
1. KONSEP DATABASE CRM
====================================================

Gunakan konsep CRM profesional.


Customer = identitas orang.

Lead = satu peluang transaksi/inquiry.


Relasi:

Customer (1) ---- (N) Lead


Contoh:


Customer:

{
  id: 1,
  nama: "Hirzi",
  nomor_hp: "081xxxx"
}


Memiliki:


Lead #1:

{
  produk: "Open Trip Ijen",
  status: "LOST"
}


Lead #2:

{
  produk: "Private Trip Bali",
  status: "HOT"
}


Jangan gunakan konsep:

"1 nomor WhatsApp = 1 Lead"


Karena customer yang sama dapat:
- bertanya trip berbeda
- repeat order
- melakukan booking kembali


====================================================
2. DATABASE SCHEMA
====================================================


Customer:


```prisma
model Customer {

  id Int @id @default(autoincrement())

  nomor_hp String @unique @db.VarChar(20)

  nama_kontak String?

  leads Lead[]

  createdAt DateTime @default(now())

  updatedAt DateTime @updatedAt
}

Lead:
model Lead {

  id Int @id @default(autoincrement())


  customer_id Int

  customer Customer @relation(
    fields:[customer_id],
    references:[id]
  )


  status_lead String @default("NEW")


  minat_destinasi String?

  jumlah_peserta Int?

  estimasi_waktu DateTime?

  catatan_khusus String?

  referral_source String?

  estimasi_nilai_order Int?



  last_activity_at DateTime?

  closed_at DateTime?



  ai_summary String?


  ai_last_analyzed_message_id Int?

  ai_last_analyzed_at DateTime?



  messages ChatMessage[]


  createdAt DateTime @default(now())

  updatedAt DateTime @updatedAt
}
Jangan gunakan:

is_processed_by_ai

pada ChatMessage.

Alasan:

Satu bubble chat tidak selalu mewakili kondisi Lead.

Analisis dilakukan berdasarkan kumpulan pesan dalam satu sesi percakapan.

====================================================
3. CHAT MESSAGE

ChatMessage adalah sumber histori utama.

Relasi:

Lead (1) ---- (N) ChatMessage

Schema:
model ChatMessage {

 id Int @id @default(autoincrement())


 lead_id Int


 lead Lead @relation(
   fields:[lead_id],
   references:[id],
   onDelete:Cascade
 )


 pengirim String

 pesan String @db.Text

 waktu_pesan DateTime


 createdAt DateTime @default(now())

}Semua bubble chat harus tetap tersimpan.

AI Summary bukan pengganti ChatMessage.

====================================================
4. LOGIC MENENTUKAN LEAD

Saat WhatsApp masuk:

Step 1:

Cari Customer berdasarkan nomor_hp.

Jika tidak ada:

Buat:

Customer baru

Lead baru

Jika Customer sudah ada:

Cari Lead terakhir.

Gunakan rule:

Jika ada Lead aktif:

status:

NEW
PROSPEK
QUALIFIED
HOT

Maka:

gunakan Lead tersebut.

Jika Lead terakhir:

LOST

atau

CLOSED

Gunakan closed_at.

Tambahkan konfigurasi:

LEAD_REOPEN_WINDOW_DAYS=30

Rule:

Jika:

current_date - closed_at <= 30 hari

maka:

REOPEN Lead lama.

Jika:

current_date - closed_at > 30 hari

buat Lead baru.

Contoh:

Lead:

Open Trip Banyuwangi

Status:

LOST

closed_at:

1 Juli

Customer chat:

20 Juli

Gunakan Lead lama.

Customer chat:

Desember

Buat Lead baru.

====================================================
5. JANGAN ANGGAP DIAM = LOST

Tidak ada chat selama beberapa hari:

BUKAN berarti LOST.

Contoh:

Customer:

"Mau paket Ijen"

Kemudian diam.

Status tetap:

PROSPEK

LOST hanya jika:

customer mengatakan batal
admin melakukan close manual
hasil analisis menyatakan transaksi gagal
====================================================
6. AI ANALYSIS ARCHITECTURE

Gunakan asynchronous workflow.

Jangan:

scan semua Lead setiap menit
query semua ChatMessage untuk checking
analisis ulang semua histori

Gunakan queue.

Flow:

WhatsApp Incoming

↓

Create ChatMessage

↓

Update Lead.last_activity_at

↓

Create / Update AIJob

↓

Debounce timer

↓

AI Queue

↓

AI Worker

↓

Bulk LLM Processing

↓

Update Lead

====================================================
7. AI JOB QUEUE

Buat tabel:

AIJob

Schema:

model AIJob {

 id Int @id @default(autoincrement())


 lead_id Int


 status String


 execute_at DateTime?


 retry_count Int @default(0)


 createdAt DateTime @default(now())

 updatedAt DateTime @updatedAt

}

Status:

WAITING

PROCESSING

DONE

FAILED

====================================================
8. DEBOUNCE SYSTEM

Jangan analisis setiap message.

Contoh:

Customer:

10:00

"Mau paket Ijen"

10:03

"Berapa harga?"

10:05

"Untuk 4 orang"

Jangan:

3 request AI.

Tunggu:

15 menit setelah aktivitas terakhir.

Maka:

10:20

Masukkan Lead ke AI queue.

====================================================
9. BULK AI PROCESSING

Jangan:

1 Lead = 1 request LLM.

Gunakan batch processing.

Contoh queue:

Lead A

Lead B

Lead C

Lead D

Lead E

Gabungkan menjadi:

1 request LLM.

Konfigurasi:

AI_BATCH_SIZE=5

Maksimal:

10 Lead per request.

Jika belum mencapai batch:

Gunakan timeout:

AI_BATCH_TIMEOUT=60 detik

Contoh:

Hari pertama:

50 Lead siap:

Batch 1:
Lead 1-10

Batch 2:
Lead 11-20

dst.

Hari kedua:

Hanya:

Lead A

Lead B

Tetap proses setelah timeout.

====================================================
10. CONTEXT YANG DIKIRIM KE LLM

Jangan kirim semua histori setiap kali.

Jika Lead belum pernah dianalisis:

Kirim seluruh conversation.

Jika sudah pernah:

Kirim:

Current Lead State
Previous AI Summary
Chat baru setelah ai_last_analyzed_message_id

Contoh:

REQUEST LLM bisa disesuaikan aja best practiced nya gimana:

{
 "task":"analyze_leads",

 "leads":[

  {

   "lead_id":101,


   "current_lead":{

    "status_lead":"NEW",

    "minat_destinasi":null,

    "jumlah_peserta":null,

    "estimasi_waktu":null

   },


   "previous_summary":null,


   "new_messages":[

    {

     "sender":"customer",

     "message":"Mau paket Bromo kak"

    },


    {

     "sender":"customer",

     "message":"Untuk 4 orang bulan Agustus"

    }

   ]

  },


  {

   "lead_id":102,


   "current_lead":{

    "status_lead":"QUALIFIED",

    "minat_destinasi":"Banyuwangi",

    "jumlah_peserta":5

   },


   "previous_summary":

   "Customer tertarik private trip Banyuwangi."


   ,

   "new_messages":[

    {

     "sender":"customer",

     "message":"Kalau DP berapa kak?"

    }

   ]

  }

 ]

}
====================================================
11. OUTPUT LLM

Tidak menggunakan:

confidence score
probability
ranking

Output harus JSON sederhana.

Format:

[
  {
    "lead_id": 12,
    "status_lead": "QUALIFIED",
    "minat_destinasi": "Ijen, Baluran, Djawatan",
    "jumlah_peserta": 4,
    "estimasi_waktu": "2026-08-15",
    "analysis_summary": "Pelanggan meminta paket private tour keluarga, membutuhkan dokumentasi DSLR, dan request jemput di Stasiun Banyuwangi Baru.",
    "referral_source": "instagram",
    "estimasi_nilai_order": 4800000
  },
  {
    "lead_id": 13,
    "status_lead": "PROSPEK",
    "minat_destinasi": "Pulau Merah",
    "jumlah_peserta": null,
    "estimasi_waktu": null,
    "analysis_summary": "Customer baru menanyakan harga paket open trip.",
    "referral_source": "tidak diketahui",
    "estimasi_nilai_order": null
  }
]
====================================================
12. RULE UPDATE DATABASE

Backend hanya update field yang ada di:

changes

Contoh:

LLM:

{
 "changes":{
  "status_lead":"HOT"
 }
}

Maka hanya update:

status_lead

Jangan mengubah field lain menjadi null.

====================================================
13. AI ANALYSIS HISTORY

Buat tabel:

AIAnalysis

Schema:

model AIAnalysis {

 id Int @id @default(autoincrement())


 lead_id Int


 result_json Json


 createdAt DateTime @default(now())

}

Gunakan untuk audit:

keputusan AI
histori perubahan
debugging
====================================================
14. IMPLEMENTATION TASK

Implementasikan:

Refactor Prisma schema
Migration database
Customer-Leads relationship
Lead creation/reopen service
ChatMessage service
AIJob queue
Debounce scheduler
Bulk AI worker
LLM context builder
JSON response parser
Lead update service
AIAnalysis history

Kode harus:

modular
scalable
clean architecture
mudah dikembangkan
siap production CRM