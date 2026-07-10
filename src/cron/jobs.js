import cron from 'node-cron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../config/prisma.js';

// SYSTEM PROMPT FOR GEMINI AI EXTRACTOR
const GEMINI_SYSTEM_PROMPT = `Kamu adalah sistem analis CRM untuk perusahaan Trip Banyuwangi. Saya akan memberikan data JSON Array berisi maksimal 5 riwayat obrolan WhatsApp antara admin dan pelanggan, dikelompokkan berdasarkan \`id_lead\`.

Tugasmu:
1. Analisis \`teks_percakapan\` setiap \`id_lead\` secara independen. Jangan mencampuradukkan data.
2. Ekstrak informasi secara presisi:
   - 'minat_destinasi' (misal: Ijen, Baluran, Djawatan, dsb)
   - 'jumlah_peserta' (dalam format angka numerik)
   - 'estimasi_waktu' (wajib format tanggal ISO 'YYYY-MM-DD', misal jika pelanggan menyebutkan 'bulan depan tanggal 15' dan tanggal hari ini adalah 2026-07-10, maka tanggal yang dihasilkan adalah '2026-08-15'. Jika tidak ada estimasi waktu atau tidak dapat dipastikan, isi dengan null)
   - 'catatan_khusus' (catatan atau ringkasan singkat mengenai kebutuhan spesifik pelanggan, kesepakatan penting, atau rangkuman inti percakapan mereka)
   - 'referral_source' (dari mana pelanggan mengetahui TripBwi, wajib pilih salah satu dari: "instagram", "tiktok", "website", "rekomendasi", "facebook", "lainnya", atau "tidak diketahui")
   - 'estimasi_nilai_order' (estimasi nilai transaksi/order dalam format angka numerik integer rupiah, misal dari chat penawaran harga 4.800.000 atau harga total yang disepakati/ditanyakan, jika tidak ada, isi dengan null)
3. Tentukan 'status_lead' HANYA dengan salah satu dari 5 pilihan berikut (Jangan gunakan status NEW):
   - PROSPEK: Pelanggan bertanya informasi umum, harga, atau fasilitas. Belum ada kepastian jadwal atau jumlah orang.
   - QUALIFIED: Pelanggan sudah menyebutkan dengan JELAS Destinasi, Jumlah Peserta, DAN Jadwal/Estimasi Waktu keberangkatan.
   - HOT: Pelanggan sudah setuju dan meminta instruksi pembayaran (meminta nomor rekening, invoice, atau berjanji akan transfer).
   - CLOSED WON: Pelanggan mengirimkan bukti transfer atau mengkonfirmasi bahwa pembayaran sudah berhasil.
   - CLOSED LOST: Pelanggan secara eksplisit membatalkan rencana, menolak tawaran, atau komplain keras.

Kembalikan jawabanmu HANYA dalam format JSON Array murni yang berisi seluruh id_lead yang diproses, tanpa awalan/akhiran markdown apapun. Struktur key wajib: \`id_lead\`, \`status_lead\`, \`minat_destinasi\`, \`jumlah_peserta\`, \`estimasi_waktu\`, \`catatan_khusus\`, \`referral_source\`, \`estimasi_nilai_order\`.`;

/**
 * Modul B: Ghosting Sweeper (Every day at 01:00 AM)
 * Cari Lead aktif yang tidak memiliki aktivitas (tidak ada update) selama 3 hari terakhir.
 * Tutup secara otomatis.
 */
export async function runGhostingSweeper() {
  console.log('[Ghosting Sweeper] Starting sweep at:', new Date().toISOString());
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const result = await prisma.lead.updateMany({
      where: {
        status_lead: {
          in: ['NEW', 'PROSPEK', 'QUALIFIED', 'HOT']
        },
        updatedAt: {
          lt: threeDaysAgo
        }
      },
      data: {
        status_lead: 'CLOSED LOST',
        catatan_sistem: 'Auto-Closed Lost: Customer terindikasi ghosting (tidak ada respon > 3 hari).'
      }
    });

    console.log(`[Ghosting Sweeper] Finished. Swept and closed ${result.count} inactive leads.`);
    return result.count;
  } catch (err) {
    console.error('[Ghosting Sweeper] Error during sweep:', err);
    throw err;
  }
}

/**
 * Modul C: Gemini AI Extractor (Every day at 02:00 AM)
 * Memproses pesan baru menggunakan AI dalam batch maksimal 5 leads.
 */
export async function runGeminiExtractor() {
  console.log('[Gemini Extractor] Starting extraction at:', new Date().toISOString());
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    console.warn('[Gemini Extractor] Warning: GEMINI_API_KEY is not set or using default placeholder.');
    return { success: false, reason: 'GEMINI_API_KEY not configured' };
  }

  try {
    // 1. Tarik semua ChatMessage yang is_processed_by_ai === false
    const unprocessedMessages = await prisma.chatMessage.findMany({
      where: {
        is_processed_by_ai: false,
        lead: {
          NOT: [
            { status_lead: 'CLOSED WON' },
            { status_lead: 'CLOSED LOST' }
          ]
        }
      },
      orderBy: { waktu_pesan: 'asc' }
    });

    if (unprocessedMessages.length === 0) {
      console.log('[Gemini Extractor] No new ChatMessages to process.');
      return { success: true, processedLeadsCount: 0 };
    }

    // 2. Kelompokkan pesan mentah tersebut berdasarkan lead_id
    const grouped = {};
    for (const msg of unprocessedMessages) {
      if (!grouped[msg.lead_id]) {
        grouped[msg.lead_id] = [];
      }
      grouped[msg.lead_id].push(msg);
    }

    const leadsPayload = [];
    for (const leadId in grouped) {
      const messages = grouped[leadId];
      const teks_percakapan = messages
        .map(m => `${m.pengirim}: ${m.pesan}`)
        .join('\n');
      
      leadsPayload.push({
        id_lead: parseInt(leadId),
        teks_percakapan
      });
    }

    // 3. BATCHING: Pecah array yang sudah dikelompokkan menjadi beberapa chunk (maksimal 5 lead_id per batch)
    const batches = [];
    for (let i = 0; i < leadsPayload.length; i += 5) {
      batches.push(leadsPayload.slice(i, i + 5));
    }

    console.log(`[Gemini Extractor] Grouped into ${leadsPayload.length} leads. Total batches: ${batches.length}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: GEMINI_SYSTEM_PROMPT
    });

    let processedCount = 0;

    // 4. Kirim setiap batch secara berurutan ke API Gemini
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      
      // Delay/jeda sekitar 2-3 detik antar request untuk menghindari rate limit
      if (index > 0) {
        console.log('[Gemini Extractor] Rate-limit delay (2.5 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 2500));
      }

      console.log(`[Gemini Extractor] Sending batch ${index + 1}/${batches.length} (contains ${batch.length} leads) to Gemini...`);
      
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const userPrompt = `Hari ini adalah tanggal: ${todayStr}. Tolong analisis data percakapan berikut:\n${JSON.stringify(batch)}`;

        let response;
        try {
          response = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          });
        } catch (err) {
          const errMsg = err.message || '';
          if (err.status === 503 || errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('Unavailable')) {
            console.warn('[Gemini Extractor] gemini-2.5-flash-lite is experiencing high demand/503. Falling back to gemini-2.5-flash...');
            const fallbackModel = genAI.getGenerativeModel({
              model: 'gemini-2.5-flash',
              systemInstruction: GEMINI_SYSTEM_PROMPT
            });
            response = await fallbackModel.generateContent({
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            });
          } else {
            throw err;
          }
        }

        const rawText = response.response.text();
        console.log(`[Gemini Extractor] Raw response from Gemini for batch ${index + 1}:`, rawText);
        
        let results;
        try {
          results = JSON.parse(rawText);
        } catch (parseErr) {
          // If Gemini wraps with markdown blocks, try to clean it
          const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          results = JSON.parse(cleanedText);
        }

        if (!Array.isArray(results)) {
          console.error('[Gemini Extractor] Response from Gemini is not an array:', results);
          continue;
        }

        // 6. Loop hasil balasan JSON dari Gemini: Update tabel Lead & ChatMessage
        for (const result of results) {
          const { id_lead, status_lead, minat_destinasi, jumlah_peserta, estimasi_waktu, catatan_khusus, referral_source, estimasi_nilai_order } = result;
          
          if (!id_lead) continue;

          // Parse estimasi_waktu to Date if possible
          let parsedDate = null;
          if (estimasi_waktu) {
            const d = new Date(estimasi_waktu);
            if (!isNaN(d.getTime())) {
              parsedDate = d;
            }
          }

          // Normalisasi array atau object dari Gemini untuk field string
          let minatDestinasiStr = minat_destinasi || null;
          if (Array.isArray(minat_destinasi)) {
            minatDestinasiStr = minat_destinasi.join(', ');
          } else if (typeof minat_destinasi === 'object' && minat_destinasi !== null) {
            minatDestinasiStr = JSON.stringify(minat_destinasi);
          }

          let catatanKhususStr = catatan_khusus || null;
          if (Array.isArray(catatan_khusus)) {
            catatanKhususStr = catatan_khusus.join(', ');
          } else if (typeof catatan_khusus === 'object' && catatan_khusus !== null) {
            catatanKhususStr = JSON.stringify(catatan_khusus);
          }

          // Update tabel Lead
          await prisma.lead.update({
            where: { id: parseInt(id_lead) },
            data: {
              status_lead,
              minat_destinasi: minatDestinasiStr,
              jumlah_peserta: jumlah_peserta ? parseInt(jumlah_peserta) : null,
              estimasi_waktu: parsedDate,
              catatan_khusus: catatanKhususStr,
              referral_source: referral_source || 'tidak diketahui',
              estimasi_nilai_order: estimasi_nilai_order ? parseInt(estimasi_nilai_order) : null
            }
          });

          // 7. Update tabel ChatMessage yang tadi diekstrak, ubah flag is_processed_by_ai menjadi true
          const messageIds = grouped[id_lead].map(m => m.id);
          await prisma.chatMessage.updateMany({
            where: {
              id: { in: messageIds }
            },
            data: {
              is_processed_by_ai: true
            }
          });

          processedCount++;
          console.log(`[Gemini Extractor] Lead ID ${id_lead} updated. Status: ${status_lead}`);
        }
      } catch (batchErr) {
        console.error(`[Gemini Extractor] Error processing batch ${index + 1}:`, batchErr);
      }
    }

    console.log(`[Gemini Extractor] Finished processing. Total processed leads: ${processedCount}`);
    return { success: true, processedLeadsCount: processedCount };
  } catch (err) {
    console.error('[Gemini Extractor] General extraction error:', err);
    throw err;
  }
}

/**
 * Initialize all Cron Jobs
 */
export function initCronJobs() {
  // Modul B: Cron Job Jam 01:00 Pagi
  cron.schedule('0 1 * * *', async () => {
    try {
      await runGhostingSweeper();
    } catch (e) {
      console.error('Scheduled Ghosting Sweeper failed:', e);
    }
  });

  // Modul C: Cron Job Jam 02:00 Pagi
  cron.schedule('0 2 * * *', async () => {
    try {
      await runGeminiExtractor();
    } catch (e) {
      console.error('Scheduled Gemini Extractor failed:', e);
    }
  });

  console.log('Cron Jobs scheduled successfully (01:00 for Sweeper, 02:00 for Gemini Extractor).');
}
