# UI/UX Redesign CRM Trip Banyuwangi

Saya ingin melakukan redesign total UI/UX project CRM saya.

Project ini adalah **CRM WhatsApp untuk Trip Banyuwangi** yang digunakan oleh admin/customer service untuk mengelola lead, membaca percakapan WhatsApp, melakukan follow up, dan memantau hasil analisis AI.

Target utama bukan sekadar tampilan yang cantik, tetapi aplikasi yang cepat digunakan untuk operasional harian.

---

## Tech Stack

Gunakan stack yang sudah ada.
Frontend: Vite
Tailwind CSS
shadcn UI

Jangan mengganti framework.

---

# Design Style

Gunakan desain modern seperti:
mobile friendly
* Linear
* Notion
* Vercel Dashboard
* Stripe Dashboard

Karakter desain:

* Clean
* Minimalis
* Banyak whitespace
* Rounded-xl
* Soft shadow
* Smooth transition
* Modern enterprise dashboard

Gunakan icon dari:

* Lucide React

---

# Color Palette

Primary:

* Emerald
* Teal

Sebagai identitas wisata alam Banyuwangi.

Secondary:

* Slate

Status Lead:

NEW
→ Gray

PROSPEK
→ Blue

QUALIFIED
→ Cyan

HOT
→ Orange

CLOSED
→ Green

LOST
→ Red

Pastikan badge status konsisten di seluruh aplikasi.

---

# Typography

Gunakan font modern.

Contoh:

Inter

atau

Geist

Ukuran:

Heading jelas.

Body nyaman dibaca.

Chat mudah discan.

---

# Sidebar

Sidebar modern.

Menu:

Dashboard

Leads

Customers

WhatsApp Inbox

AI Analysis

Reports

Settings

Sidebar dapat collapse.

Highlight menu aktif.

---

# Dashboard

Dashboard harus memberikan informasi penting dalam sekali lihat.

Widget:

* Total Lead
* Lead Baru Hari Ini
* HOT Lead
* Closed
* Lost
* Estimasi Revenue
* AI Queue

Tambahkan grafik:

Lead per hari

Lead berdasarkan status

Top Destination

Referral Source

---

# Leads Page

Halaman Leads menjadi fokus utama.

Gunakan Data Table modern.

Kolom:

Lead ID

Customer

Nomor WhatsApp

Status

Destinasi

Jumlah Peserta

Estimasi Tanggal

Estimasi Order

Last Activity

Assigned Admin

Aksi

Fitur:

* Search realtime
* Filter status
* Filter tanggal
* Filter admin
* Sort
* Pagination

Klik satu Lead membuka Detail Panel tanpa reload halaman.

---

# Lead Detail

Layout dua kolom.

Kiri:

Informasi Lead.

* Status
* Customer
* Destinasi
* Jumlah Peserta
* Estimasi Berangkat
* Referral
* Estimasi Revenue
* AI Summary

Kanan:

Percakapan WhatsApp.

Bubble seperti WhatsApp.

Bedakan:

Customer

Admin

Timestamp

Auto scroll.

Support ribuan chat.

---

# WhatsApp Conversation

Desain mirip WhatsApp Desktop.

Bubble:

Customer

↓

warna putih

Admin

↓

warna hijau muda

Tanggal dipisahkan.

Unread indicator.

Smooth scrolling.

---

# AI Summary Card

Tampilkan hasil AI dengan desain modern.

Contoh:

AI Summary

Status:
HOT

Ringkasan:

Customer ingin private trip Banyuwangi untuk 4 orang bulan Agustus.

Estimasi:

Rp4.800.000

Update terakhir:

2 menit lalu

Gunakan card premium.

---

# Customer Page

Menampilkan:

Nama

Nomor

Jumlah Lead

Status terakhir

Total transaksi

Klik customer membuka histori semua Lead miliknya.

---

# AI Queue Page

Halaman monitoring worker AI.

Tampilkan:

Waiting

Processing

Done

Failed

Retry Count

Execute At

Lead

Status menggunakan badge.

Auto refresh.

---

# Report Page

Grafik modern.

Lead Conversion Funnel.

NEW

↓

PROSPEK

↓

QUALIFIED

↓

HOT

↓

CLOSED

Tambahkan:

Revenue

Top Destination

Admin Performance

Referral Source

---

# Loading State

Gunakan:

Skeleton Loading

Bukan spinner biasa.

---

# Empty State

Jika data kosong:

Gunakan ilustrasi sederhana.

Contoh:

Belum ada Lead.

Import WhatsApp atau tunggu chat pertama masuk.

---

# Notification

Gunakan Toast.

Contoh:

Lead berhasil diperbarui.

AI Analysis selesai.

Customer berhasil dibuat.

---

# Dark Mode

Support penuh.

Semua komponen harus tetap nyaman dibaca.

---

# Responsive

Desktop menjadi prioritas utama.

Tetap usable di Tablet.

Mobile minimal tetap dapat digunakan.

---

# UX

Kurangi jumlah klik.

Semua aksi penting maksimal 2 klik.

Gunakan modal atau side panel daripada pindah halaman.

Jangan sering melakukan full page reload.

Gunakan transisi halus.

---

# Code Quality

Gunakan reusable component.

Pisahkan:

components/

layouts/

pages/

hooks/

services/

types/

utils/

Gunakan clean architecture.

---

# Tujuan Akhir

Saya ingin CRM ini terasa seperti aplikasi SaaS profesional yang digunakan tim customer service setiap hari.

Fokus pada:

* kecepatan operasional
* kemudahan membaca chat
* monitoring lead
* monitoring AI
* desain modern
* user experience yang intuitif
* konsistensi komponen
* maintainable dan scalable.

---

# Technical & Performance Constraints (For Low-End Devices)

* **Chat Virtualization**: Bagian WhatsApp Conversation WAJIB menggunakan virtual scrolling (misal TanStack Virtual atau React Virtuoso) untuk menangani ribuan chat tanpa membebani RAM browser.
* **Debounced Search**: Input search pada Data Table wajib menggunakan debounce (300ms) agar HP tidak lag saat admin mengetik dengan cepat.
* **State Efficiency**: Gunakan Zustand untuk mengelola state data leads, chat, dan AI Queue agar tidak memicu re-render massal pada komponen UI yang tidak berubah.
* **Bundle Optimization**: Maksimalkan fitur Tree Shaking dari Vite dan Tailwind CSS agar ukuran bundle akhir sesedikit mungkin. Gunakan React.lazy() untuk code-splitting berbasis route halaman.

sesuaikan aja gimana enaknya
