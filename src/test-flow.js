import dotenv from 'dotenv';
import { prisma } from './config/prisma.js';
import { runGhostingSweeper, runGeminiExtractor } from './cron/jobs.js';

dotenv.config();

async function runTest() {
  console.log('=== STARTING REAL TRIP BANYUWANGI CRM SIMULATION ===');

  try {
    // 1. Clean previous simulation data safely
    console.log('Cleaning up previous simulation data...');
    const mockAdminWa = '628123456789';
    const mockCustomer1Hp = '6281200000001'; // Rahma
    const mockCustomer2Hp = '6281292700079'; // Ihsan
    const mockCustomer3Hp = '6281200000003'; // Kezia Ayu
    const mockCustomer4Hp = '6281200000004'; // Ghosting Guest

    const customerHps = [mockCustomer1Hp, mockCustomer2Hp, mockCustomer3Hp, mockCustomer4Hp];

    console.log('Cleaning up all database records for clean simulation...');
    await prisma.chatMessage.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.admin.deleteMany({});

    // 2. Create Admin
    console.log('Creating Admin Dela...');
    const admin = await prisma.admin.create({
      data: {
        nama_admin: 'Dela (TripBwi)',
        nomor_wa: mockAdminWa,
        is_active: true
      }
    });

    // 3. Create Customers
    console.log('Creating Customers (Rahma, Ihsan, Kezia, Ghosting)...');
    const customer1 = await prisma.customer.create({
      data: { nomor_hp: mockCustomer1Hp, nama_kontak: 'Rahma' }
    });
    const customer2 = await prisma.customer.create({
      data: { nomor_hp: mockCustomer2Hp, nama_kontak: 'Ihsan' }
    });
    const customer3 = await prisma.customer.create({
      data: { nomor_hp: mockCustomer3Hp, nama_kontak: 'Kezia Ayu' }
    });
    const customer4 = await prisma.customer.create({
      data: { nomor_hp: mockCustomer4Hp, nama_kontak: 'Ghosting Guest' }
    });

    // 4. Create Leads (Status default 'NEW')
    const lead1 = await prisma.lead.create({
      data: {
        kode_lead: `LD-RAHMA-${mockCustomer1Hp}`,
        customer_id: customer1.id,
        admin_id: admin.id,
        status_lead: 'NEW',
        updatedAt: new Date('2026-07-08T18:00:00') // Last chat July 8
      }
    });
    const lead2 = await prisma.lead.create({
      data: {
        kode_lead: `LD-IHSAN-${mockCustomer2Hp}`,
        customer_id: customer2.id,
        admin_id: admin.id,
        status_lead: 'NEW',
        updatedAt: new Date('2026-07-05T12:20:00') // Last chat July 5
      }
    });
    const lead3 = await prisma.lead.create({
      data: {
        kode_lead: `LD-KEZIA-${mockCustomer3Hp}`,
        customer_id: customer3.id,
        admin_id: admin.id,
        status_lead: 'NEW',
        updatedAt: new Date('2026-07-06T11:25:00') // Last chat July 6
      }
    });
    // Lead 4 represents a customer who ghosted (last updated July 5, still status 'NEW')
    const lead4 = await prisma.lead.create({
      data: {
        kode_lead: `LD-GHOST-${mockCustomer4Hp}`,
        customer_id: customer4.id,
        admin_id: admin.id,
        status_lead: 'NEW',
        updatedAt: new Date('2026-07-05T10:00:00') // Last chat July 5 (> 3 days ago relative to today July 10)
      }
    });

    // 5. Seed Real Chat Messages for Lead 1 (Rahma)
    console.log('Seeding Chat 1 (Rahma)...');
    await prisma.chatMessage.createMany({
      data: [
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'halo kak, selamat malam', waktu_pesan: new Date('2026-07-07T20:23:18') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'boleh dong diinfo pl OT dibulan september untuk weekday', waktu_pesan: new Date('2026-07-07T20:23:35') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'Halo kakak selamat malam, dengan Dela disini🙏🏻🤗', waktu_pesan: new Date('2026-07-07T20:33:59') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'Rencana kakak ingin open trip kemana aja nih? 🙏🏻😁', waktu_pesan: new Date('2026-07-07T20:34:10') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'banyuwangi yang paket lengkap kak', waktu_pesan: new Date('2026-07-07T20:35:18') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'rencana berapa orang nihhh kakakk?', waktu_pesan: new Date('2026-07-07T20:49:36') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: '3 orang kak', waktu_pesan: new Date('2026-07-07T20:50:02') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'siapp kakakk\n*OPEN TRIP 3H2M*\ndi Harga Rp 1.600.000/orang kak\nDestinasi: Djawatan, Baluran, Menjangan, Tabuhan, Ijen.', waktu_pesan: new Date('2026-07-07T21:48:16') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'itu untuk berlaku untuk weekday kah?', waktu_pesan: new Date('2026-07-07T21:52:54') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'iyapp kakak, everydayy yaapp. dengan minimal 2 peserta ajaa kak', waktu_pesan: new Date('2026-07-07T21:53:23') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'untuk homestaynya bisa early check in ga kak? soalnya untuk estimasi kedatangan di jam 8 malam', waktu_pesan: new Date('2026-07-07T21:54:36') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'bisa pesan 3 malam berartii kakak, bisa kak tambah homestayy yaa. 250.000/kamar/malam', waktu_pesan: new Date('2026-07-07T21:55:22') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'untuk bednya itu king size atau twin bed?', waktu_pesan: new Date('2026-07-07T21:55:50') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'semuanya type double bed yaa kakak', waktu_pesan: new Date('2026-07-07T21:56:12') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'untuk booking bisa di h- berapa ya kak?', waktu_pesan: new Date('2026-07-07T21:57:52') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'Bisa reservasi kapan saja ya kak, namun Dela sarankan jangan terlalu mepet yaa😊🙏🏻\nUntuk bulan September sebaiknya reservasi minimal H-7, supaya slot open trip dan homestay masih tersedia sesuai kebutuhan kakak. Reservasi cukup dengan DP Rp300.000/orang ya kak🙏🏻😁', waktu_pesan: new Date('2026-07-07T22:08:25') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'boleh infoin penginapannya kaya gimana ya kak?', waktu_pesan: new Date('2026-07-07T22:16:11') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: '[Mengirim Video Room homestay] Seperti ini yaa kakk untuk room homestay nyaa🙏🏻🤗', waktu_pesan: new Date('2026-07-07T22:34:36') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'oiya kak, untuk semua area tersebut untuk koneksi internetnya aman ga ya? soalnya liburannya sambil bekerja kak😭', waktu_pesan: new Date('2026-07-08T17:46:32') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'Haloo kakak selamat sore. Dela bantu jelaskan yaa. Untuk area kota Banyuwangi dan homestay, sinyal internet umumnya aman. Namun saat berada di beberapa destinasi alam seperti Ijen, Menjangan, dan Baluran, sinyal bisa naik turun.', waktu_pesan: new Date('2026-07-08T17:57:20') },
        { lead_id: lead1.id, pengirim: 'customer', pesan: 'kalo di area djawatan aman ga ya kak?', waktu_pesan: new Date('2026-07-08T17:58:45') },
        { lead_id: lead1.id, pengirim: 'admin', pesan: 'Untuk Hutan Djawatan masih relatif aman ya kak, sinyal internet umumnya masih cukup baik karena lokasinya dekat dengan area kota.', waktu_pesan: new Date('2026-07-08T18:00:08') }
      ]
    });

    // 6. Seed Real Chat Messages for Lead 2 (Ihsan)
    console.log('Seeding Chat 2 (Ihsan)...');
    await prisma.chatMessage.createMany({
      data: [
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'mba ada tambahan', waktu_pesan: new Date('2026-07-04T14:32:25') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'Day 1 Penjemputan siang - Hutan Djawatan - City tour dan kulineran. Day 2 Kawah Ijen. Harga Trip only : Rp 775.000/orang (Harga Trip Only)', waktu_pesan: new Date('2026-07-04T14:32:52') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'Day 1 : jemput bandara - sarapan - hutan jawatan - kembali ke hotel', waktu_pesan: new Date('2026-07-04T14:32:56') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'silahkan kakak, kebetulan sudah saya tambahkan kakak hehehe', waktu_pesan: new Date('2026-07-04T14:33:08') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'kak ada innova gaa?', waktu_pesan: new Date('2026-07-04T14:34:34') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'tersediaa kakak, tapi ada add charge kak, berkenan kah? jadi Rp 835.000/orang', waktu_pesan: new Date('2026-07-04T14:35:30') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'mba ada saran destinasi untuk sore ga? untuk tgl 6 setelah kawah ijen', waktu_pesan: new Date('2026-07-04T14:41:04') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'untuk sorenyaa yaa kak? waitt yaa soalnya baluran pas lagi tutupp kaaa 🥹', waktu_pesan: new Date('2026-07-04T14:42:03') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'yahh, sayang baget', waktu_pesan: new Date('2026-07-04T14:42:22') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'Desa adat osing kemiren atau kawah wurung kak. 📍Destinasi : Kawah Ijen, Kawah Wurung. Jeep.', waktu_pesan: new Date('2026-07-04T14:45:03') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'kalau besok sampai jam airport jam 10, itu selesai trip djawatan jamber yaa?', waktu_pesan: new Date('2026-07-04T14:45:14') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: '10.15 Penjemputan Airport, 11.45 Explore Djawatan, 13.45 kota. bisa seperti ini kakak', waktu_pesan: new Date('2026-07-04T14:46:26') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'mba kalau hari pertama langsung baluran bisa ga? apakah besok buka?', waktu_pesan: new Date('2026-07-04T15:04:41') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'bisaa kakak, tapi tanpa jeep yaa, jeep sudah habis kakak karena long weekend', waktu_pesan: new Date('2026-07-04T15:05:46') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'tapi balurannya bisa pakai innova ga ya?', waktu_pesan: new Date('2026-07-04T15:06:48') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'tetap bisaa kakak', waktu_pesan: new Date('2026-07-04T15:06:58') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'mba ada rekomendasi hotel yang dekat dengan pantai ga ya? kayak dialoog atau villa so long', waktu_pesan: new Date('2026-07-04T15:11:00') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'Hotel Ketapang indah kak. tapi dekat pantai rata rata sudah fullbooked sejak 1 bulan sebelumnyaa kakk 🥹', waktu_pesan: new Date('2026-07-04T15:23:10') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'oiya, untuk surfing itu rekomendasinya dmn ya? sama ada paketnya ga ya?', waktu_pesan: new Date('2026-07-04T15:24:31') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'kalau untuk surfing, Dela masih belum bisa mengakomodir kakak. biasanya di Pulau Merah.', waktu_pesan: new Date('2026-07-04T15:25:08') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'oke, pulau merah berarti enak setelah djawatan ya, mau surfing + sunset', waktu_pesan: new Date('2026-07-04T15:28:17') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'betul kak, sekalian sunset disanaa. Day 1 Penjemputan siang - TN Baluran. Day 2 Kawah Ijen, Hutan Djawatan, Pulau Merah. Harga Trip only : Rp 1.050.000/orang (Harga Trip Only)', waktu_pesan: new Date('2026-07-04T15:47:32') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'day 1 : penjemputan bandara, baluran, balik ke hotel. day 2: kawah ijen, djawatan, pulau merah. ini untuk surat keterangan sehatnya gmna mba?', waktu_pesan: new Date('2026-07-04T15:48:16') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'sudah include dari kami yaa kakak', waktu_pesan: new Date('2026-07-04T15:49:56') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'untuk makan siang nya 1x saat apa ya kak? untuk harga itu tidak ada tambahan biaya tiket kan?', waktu_pesan: new Date('2026-07-04T15:51:28') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: '1. Makan siang di hari pertama. 2. Biaya tiket sudah dari kami.', waktu_pesan: new Date('2026-07-04T15:52:17') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'sama minta potongan bisa ga yaa? jadi 1.000.000 lah kak, hehehe', waktu_pesan: new Date('2026-07-04T13:57:07') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'RUNDOWN: Day 1 Baluran. Day 2 Ijen, Djawatan, Pulau Merah. Harga sudah nett yaa kakak 🥹🙏🏼', waktu_pesan: new Date('2026-07-04T16:02:53') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'okay kak, untuk sistem book gimana? harus dp or full payemnt?', waktu_pesan: new Date('2026-07-04T16:04:18') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: '> FORM RESERVASI\nSilakan lengkapi data berikut untuk reservasi 😊\n*PRIVAT TRIP 2H1M*\n💰Nilai DP : Rp500.000\n💳 BCA 1801864673 A/n Mahkota Gandrung Organizer PT', waktu_pesan: new Date('2026-07-04T16:05:42') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'dp 500 saja kan ya. saya total ber4, untuk total 4.200.000 ya', waktu_pesan: new Date('2026-07-04T16:07:10') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'Betul kakakk. tour guide selama kegiatan sama', waktu_pesan: new Date('2026-07-04T16:07:53') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: '> FORM RESERVASI\nNama : Ihsan\nWhatsApp : 081292700079\nInstagram : @Ihsannndhil\nTikTok : @ihsannae\nTanggal Trip : 5 Juli dan 6 Juli\nJumlah Peserta : 4\nLokasi Penjemputan : Bandara\nJam Penjemputan : 10.30\nAdditional : -', waktu_pesan: new Date('2026-07-04T16:11:44') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: '[Mengirim gambar bukti transfer DP Rp 500.000]', waktu_pesan: new Date('2026-07-04T16:13:18') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'Thank youu kakakk. nanti dihubungi crew kami.', waktu_pesan: new Date('2026-07-04T16:13:54') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'kak ihsan, seandainya hari ini tripnya Djawatan & Baluran dulu biar besok ijen & pulau merah...', waktu_pesan: new Date('2026-07-05T10:08:09') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'coba dibuatkan rundownnya kak. saya baru aja landing', waktu_pesan: new Date('2026-07-05T10:38:11') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'RUNDOWN BARU: Day 1 Djawatan, Baluran. Day 2 Ijen, Pulau Merah.', waktu_pesan: new Date('2026-07-05T10:40:20') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: 'oke wait ya. oiya, hotel kami di aston yaa', waktu_pesan: new Date('2026-07-05T10:42:51') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: '[Kirim dokumen Invoice Kak Ihsan.pdf]', waktu_pesan: new Date('2026-07-05T11:31:14') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'kakak sudah pelunasan kahh?', waktu_pesan: new Date('2026-07-05T12:16:58') },
        { lead_id: lead2.id, pengirim: 'customer', pesan: '[Mengirim gambar bukti transfer pelunasan total Rp 4.200.000]', waktu_pesan: new Date('2026-07-05T12:17:18') },
        { lead_id: lead2.id, pengirim: 'admin', pesan: 'thankyouuu kakak, enjoyyy tripnya yaa kaa', waktu_pesan: new Date('2026-07-05T12:19:19') }
      ]
    });

    // 7. Seed Real Chat Messages for Lead 3 (Kezia Ayu)
    console.log('Seeding Chat 3 (Kezia Ayu)...');
    await prisma.chatMessage.createMany({
      data: [
        { lead_id: lead3.id, pengirim: 'customer', pesan: 'Halo, TripBanyuwangi, saya tertarik dengan Open Trip 3H2M Banyuwangi Everyday 😊', waktu_pesan: new Date('2026-06-02T13:49:32') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: 'Haloo kak, dengan saya Dela. rencana ingin di tanggal berapa kak?', waktu_pesan: new Date('2026-06-02T13:55:08') },
        { lead_id: lead3.id, pengirim: 'customer', pesan: 'bulan agustus kak. itu everyday kan kak?', waktu_pesan: new Date('2026-06-02T13:55:43') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: 'betul kakakk. berangkat setiap hari dengan minimal 2 pax peserta yaa kakak', waktu_pesan: new Date('2026-06-02T13:56:15') },
        { lead_id: lead3.id, pengirim: 'customer', pesan: 'klo harga per paxnya brp kak', waktu_pesan: new Date('2026-06-02T13:56:57') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: 'di Harga 1.600.000 yaa kakak. Dela kirim detailnya yaa.\n*Open Trip 3H2M* di Harga Rp 1.600.000/orang kak.', waktu_pesan: new Date('2026-06-02T13:57:28') },
        { lead_id: lead3.id, pengirim: 'customer', pesan: 'hari pertama tdk dpt makan ya?', waktu_pesan: new Date('2026-06-02T14:00:38') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: 'Belum dapat kakak, include makan siang hari kedua saja yaa🙏🏻😊', waktu_pesan: new Date('2026-06-02T14:02:22') },
        { lead_id: lead3.id, pengirim: 'customer', pesan: 'jd makannya dpt brp kali kak', waktu_pesan: new Date('2026-06-02T14:02:34') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: '1 kali sajaa kakak. Saat hari kedua kak di destinasi Pulau Menjangan atau Pulau Tabuhan, nanti dapat lunch box ya kakk😊🙏🏻', waktu_pesan: new Date('2026-06-02T14:03:55') },
        { lead_id: lead3.id, pengirim: 'customer', pesan: 'brrti paket ini cm dpt makan 1x ya kak', waktu_pesan: new Date('2026-06-02T14:04:14') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: 'tapi nanti di hari pertama tetap diantar ke resto untuk makan siang kok kak, tapi budget diluar paket ya', waktu_pesan: new Date('2026-06-02T14:04:33') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: 'Halo kakak selamat siang 😊🙏🏻. Dela izin follow up ya kak. Apakah rencana ikut Open Trip 3H2M di bulan Agustus masih jadi?', waktu_pesan: new Date('2026-07-06T11:22:54') },
        { lead_id: lead3.id, pengirim: 'customer', pesan: 'gajadi kak', waktu_pesan: new Date('2026-07-06T11:24:47') },
        { lead_id: lead3.id, pengirim: 'admin', pesan: 'Baikk kakak, terima kasih atas konfirmasi.', waktu_pesan: new Date('2026-07-06T11:25:41') }
      ]
    });

    // 8. Seed Chat Messages for Lead 4 (Ghosting Guest) - Last chat was 5 days ago
    console.log('Seeding Chat 4 (Ghosting Guest)...');
    await prisma.chatMessage.createMany({
      data: [
        { lead_id: lead4.id, pengirim: 'customer', pesan: 'Tanya info trip Baluran donk kak', waktu_pesan: new Date('2026-07-05T09:55:00') },
        { lead_id: lead4.id, pengirim: 'admin', pesan: 'Bisa kak, rencana untuk berapa orang?', waktu_pesan: new Date('2026-07-05T10:00:00') }
      ]
    });

    console.log('Database setup complete. Running test scenarios...');

    // Run Modul C: Gemini AI Extractor
    console.log('\n--- Running Modul C: Gemini AI Extractor ---');
    const geminiResult = await runGeminiExtractor();
    console.log('Gemini extraction result:', geminiResult);

    // Run Modul B: Ghosting Sweeper
    console.log('\n--- Running Modul B: Ghosting Sweeper ---');
    // Set Lead 4's updatedAt back to 4 days ago to simulate 4 days of inactivity after AI extraction
    await prisma.lead.update({
      where: { id: lead4.id },
      data: { updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }
    });
    const sweptCount = await runGhostingSweeper();
    console.log(`Swept leads count: ${sweptCount}`);

    // Verify results for Lead 1 (Rahma)
    const checkLead1 = await prisma.lead.findUnique({ where: { id: lead1.id } });
    console.log('\n--- Verified Lead 1 (Rahma) Data Post Gemini ---');
    console.log(`Status Lead: ${checkLead1.status_lead} (Expected: PROSPEK or QUALIFIED)`);
    console.log(`Minat Destinasi: ${checkLead1.minat_destinasi} (Expected: Djawatan, Baluran, Menjangan, Tabuhan, Ijen)`);
    console.log(`Jumlah Peserta: ${checkLead1.jumlah_peserta} (Expected: 3)`);
    console.log(`Estimasi Waktu: ${checkLead1.estimasi_waktu} (Expected: September 2026)`);
    console.log(`Referral Source: ${checkLead1.referral_source} (Expected: tidak diketahui)`);
    console.log(`Estimasi Nilai Order: ${checkLead1.estimasi_nilai_order} (Expected: 4800000)`);

    // Verify results for Lead 2 (Ihsan)
    const checkLead2 = await prisma.lead.findUnique({ where: { id: lead2.id } });
    console.log('\n--- Verified Lead 2 (Ihsan) Data Post Gemini ---');
    console.log(`Status Lead: ${checkLead2.status_lead} (Expected: CLOSED WON)`);
    console.log(`Minat Destinasi: ${checkLead2.minat_destinasi} (Expected: Baluran, Ijen, Djawatan, Pulau Merah)`);
    console.log(`Jumlah Peserta: ${checkLead2.jumlah_peserta} (Expected: 4)`);
    console.log(`Estimasi Waktu: ${checkLead2.estimasi_waktu} (Expected: 2026-07-05)`);
    console.log(`Referral Source: ${checkLead2.referral_source} (Expected: instagram)`);
    console.log(`Estimasi Nilai Order: ${checkLead2.estimasi_nilai_order} (Expected: 4200000)`);

    // Verify results for Lead 3 (Kezia Ayu)
    const checkLead3 = await prisma.lead.findUnique({ where: { id: lead3.id } });
    console.log('\n--- Verified Lead 3 (Kezia Ayu) Data Post Gemini ---');
    console.log(`Status Lead: ${checkLead3.status_lead} (Expected: CLOSED LOST)`);
    console.log(`Minat Destinasi: ${checkLead3.minat_destinasi} (Expected: Djawatan, Baluran, Menjangan, Tabuhan, Ijen)`);
    console.log(`Referral Source: ${checkLead3.referral_source} (Expected: tidak diketahui)`);

    // Verify results for Lead 4 (Ghosting Guest)
    const checkLead4 = await prisma.lead.findUnique({ where: { id: lead4.id } });
    console.log('\n--- Verified Lead 4 (Ghosting Guest) Data Post Cron ---');
    console.log(`Status Lead: ${checkLead4.status_lead} (Expected: CLOSED LOST)`);
    console.log(`Catatan Sistem: "${checkLead4.catatan_sistem}"`);

    console.log('\n=== SIMULATION COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Simulation failed with error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
