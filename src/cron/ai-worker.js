import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { prisma } from '../config/prisma.js';
import { getGreetingRules } from '../services/greeting-rules.js';

// Limits for image attachments sent to Gemini (images are already compressed at ingest time)
const MAX_IMAGES_PER_LEAD = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

let workerIntervalId = null;

/**
 * Start the background AI worker.
 */
export function startAIWorker() {
  const intervalSeconds = parseInt(process.env.AI_WORKER_INTERVAL, 10) || 30;
  console.log(`[AI Worker] Starting background worker with interval: ${intervalSeconds}s`);
  
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
  }
  
  workerIntervalId = setInterval(async () => {
    try {
      await processAIQueue();
    } catch (err) {
      console.error('[AI Worker] Error inside worker cycle:', err);
    }
  }, intervalSeconds * 1000);
}

/**
 * Stop the background AI worker.
 */
export function stopAIWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('[AI Worker] Background worker stopped.');
  }
}

/**
 * Main queue processing cycle.
 */
export async function processAIQueue(force = false) {
  const now = new Date();
  
  // 1. Get ready WAITING jobs, limit to 50
  const readyJobs = await prisma.aIJob.findMany({
    where: {
      status: 'WAITING',
      ...(force ? {} : { execute_at: { lte: now } })
    },
    orderBy: {
      execute_at: 'asc'
    },
    take: 50
  });

  if (readyJobs.length === 0) {
    if (!force) {
      const oldestWaitingJob = await prisma.aIJob.findFirst({
        where: { status: 'WAITING' },
        orderBy: { execute_at: 'asc' }
      });
      if (oldestWaitingJob && oldestWaitingJob.execute_at) {
        const diffSeconds = Math.max(0, Math.ceil((new Date(oldestWaitingJob.execute_at) - now) / 1000));
        const diffMinutes = (diffSeconds / 60).toFixed(1);
        console.log(`[AI Worker] No jobs ready to execute yet. Oldest WAITING job is Job ID ${oldestWaitingJob.id} (Lead ${oldestWaitingJob.lead_id}), executing in ${diffSeconds}s (${diffMinutes}m).`);
      }
    }
    return;
  }

  // 2. Determine batch size
  const batchSize = parseInt(process.env.AI_BATCH_SIZE, 10) || 5;
  const batchMaxSize = parseInt(process.env.AI_BATCH_MAX_SIZE, 10) || 10;
  const batchTimeout = parseInt(process.env.AI_BATCH_TIMEOUT, 10) || 60;
  
  let jobsToProcess = [];

  if (force) {
    console.log(`[AI Worker] Force mode active. Bypassing size and timeout checks.`);
    jobsToProcess = readyJobs.slice(0, batchMaxSize);
  } else if (readyJobs.length >= batchSize) {
    // Take up to batchMaxSize jobs
    jobsToProcess = readyJobs.slice(0, batchMaxSize);
  } else {
    // Less than batchSize. Check if the oldest job has timed out
    const oldestJob = readyJobs[0];
    const secondsWaiting = (now.getTime() - new Date(oldestJob.execute_at).getTime()) / 1000;
    
    if (secondsWaiting >= batchTimeout) {
      console.log(`[AI Worker] Batch timeout reached (${secondsWaiting.toFixed(1)}s >= ${batchTimeout}s). Processing smaller batch of ${readyJobs.length} leads.`);
      jobsToProcess = readyJobs;
    } else {
      // Not enough jobs yet, and oldest hasn't timed out. Skip processing this cycle.
      return;
    }
  }

  const jobIds = jobsToProcess.map(j => j.id);
  const leadIds = jobsToProcess.map(j => j.lead_id);
  
  console.log(`[AI Worker] Processing batch of ${jobsToProcess.length} jobs. Job IDs: [${jobIds.join(', ')}], Lead IDs: [${leadIds.join(', ')}]`);

  // 3. Lock Jobs in a Transaction with optimistic concurrency lock
  try {
    const lockResults = await prisma.$transaction(
      jobsToProcess.map(job =>
        prisma.aIJob.updateMany({
          where: { 
            id: job.id,
            status: 'WAITING'
          },
          data: { status: 'PROCESSING' }
        })
      )
    );

    // Check if any job failed to lock (meaning another process locked it first)
    const allLocked = lockResults.every(r => r.count === 1);
    if (!allLocked) {
      console.warn('[AI Worker] Some jobs in batch were already locked by another process. Skipping batch.');
      // Rollback successfully locked jobs in this batch back to WAITING
      const successfullyLocked = [];
      for (let i = 0; i < lockResults.length; i++) {
        if (lockResults[i].count === 1) {
          successfullyLocked.push(jobsToProcess[i].id);
        }
      }
      if (successfullyLocked.length > 0) {
        await prisma.aIJob.updateMany({
          where: { id: { in: successfullyLocked } },
          data: { status: 'WAITING' }
        });
      }
      return;
    }
  } catch (lockErr) {
    console.error('[AI Worker] Failed to lock jobs to PROCESSING. Skipping batch.', lockErr);
    return;
  }

  // 4. Build Context for LLM
  const leadsContext = [];
  const imageAttachments = []; // { lead_id, ref, mimeType, data } — labeled per lead so images never get mixed up between leads
  const latestMessageIds = new Map(); // Map lead_id -> latest message ID

  for (const job of jobsToProcess) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: job.lead_id }
      });

      if (!lead) {
        // Lead deleted. Mark job as done
        await prisma.aIJob.update({ where: { id: job.id }, data: { status: 'DONE' } });
        continue;
      }

      // Query ChatMessage based on last analyzed ID
      let messages = [];
      if (lead.ai_last_analyzed_message_id === null) {
        messages = await prisma.chatMessage.findMany({
          where: { lead_id: lead.id },
          orderBy: { id: 'asc' }
        });
      } else {
        messages = await prisma.chatMessage.findMany({
          where: {
            lead_id: lead.id,
            id: { gt: lead.ai_last_analyzed_message_id }
          },
          orderBy: { id: 'asc' }
        });
      }

      if (messages.length === 0) {
        // No new messages. Mark job as done
        await prisma.aIJob.update({ where: { id: job.id }, data: { status: 'DONE' } });
        continue;
      }

      // Record the latest message ID processed
      const latestMsgId = messages[messages.length - 1].id;
      latestMessageIds.set(lead.id, latestMsgId);

      const adminMessageCount = await prisma.chatMessage.count({
        where: {
          lead_id: lead.id,
          pengirim: 'admin'
        }
      });
      const adminHasReplied = adminMessageCount > 0;

      // Attach images (e.g. payment proofs) from the newest unanalyzed messages.
      // Each image gets a unique ref (IMG_<messageId>) bound to this lead_id so the LLM cannot confuse
      // images between different leads inside the same bulk batch.
      const leadImageRefs = new Map(); // message.id -> ref
      const imageMessages = messages
        .filter(m => m.media_type === 'image' && m.media_path)
        .slice(-MAX_IMAGES_PER_LEAD);
      for (const m of imageMessages) {
        try {
          if (!fs.existsSync(m.media_path)) continue;
          const stat = fs.statSync(m.media_path);
          if (stat.size === 0 || stat.size > MAX_IMAGE_BYTES) continue;
          const ref = `IMG_${m.id}`;
          imageAttachments.push({
            lead_id: lead.id,
            ref,
            mimeType: m.media_mime || 'image/jpeg',
            data: fs.readFileSync(m.media_path).toString('base64')
          });
          leadImageRefs.set(m.id, ref);
        } catch (imgErr) {
          console.warn(`[AI Worker] Failed to read image attachment for message ${m.id} (Lead ${lead.id}):`, imgErr.message);
        }
      }

      leadsContext.push({
        lead_id: lead.id,
        current_lead: {
          status_lead: lead.status_lead,
          minat_destinasi: lead.minat_destinasi,
          jumlah_peserta: lead.jumlah_peserta,
          estimasi_waktu: lead.estimasi_waktu ? lead.estimasi_waktu.toISOString().split('T')[0] : null,
          referral_source: lead.referral_source,
          estimasi_nilai_order: lead.estimasi_nilai_order
        },
        admin_has_replied: adminHasReplied,
        previous_summary: lead.ai_summary || null,
        new_messages: messages.map(m => ({
          sender: m.pengirim,
          message: m.pesan,
          ...(m.reply_to_snippet ? { reply_to: m.reply_to_snippet } : {}),
          ...(leadImageRefs.has(m.id) ? { image_ref: leadImageRefs.get(m.id) } : {})
        }))
      });
    } catch (ctxErr) {
      console.error(`[AI Worker] Failed to build context for Lead ${job.lead_id}:`, ctxErr);
      await rescheduleFailedJob(job);
    }
  }

  if (leadsContext.length === 0) {
    return;
  }

  // 5. Send Bulk Request to Gemini (with fallback to individual calls if bulk fails)
  let aiResults = [];
  let useFallbackIndividual = false;
  try {
    aiResults = await callGeminiBulk(leadsContext, imageAttachments);
  } catch (apiErr) {
    console.warn('[AI Worker] Gemini bulk call failed. Falling back to individual processing to prevent poison pills. Error:', apiErr.message);
    useFallbackIndividual = true;
  }

  if (useFallbackIndividual) {
    for (const ctx of leadsContext) {
      try {
        console.log(`[AI Worker] Analyzing Lead ${ctx.lead_id} individually...`);
        const individualResult = await callGeminiBulk([ctx], imageAttachments.filter(img => img.lead_id === ctx.lead_id));
        if (individualResult && individualResult.length > 0) {
          aiResults.push(individualResult[0]);
        }
      } catch (indivErr) {
        console.error(`[AI Worker] Individual analysis failed for Lead ${ctx.lead_id}:`, indivErr.message);
        // Will be rescheduled in step 6 since it won't be in aiResults
      }
    }
  }

  // 6. Update Database with Analysis Results
  for (const job of jobsToProcess) {
    const result = aiResults.find(r => r.lead_id === job.lead_id);
    if (!result) {
      console.warn(`[AI Worker] No LLM response returned for Lead ${job.lead_id}. Rescheduling...`);
      await rescheduleFailedJob(job);
      continue;
    }

    try {
      const lead = await prisma.lead.findUnique({ where: { id: job.lead_id } });
      if (!lead) {
        await prisma.aIJob.update({ where: { id: job.id }, data: { status: 'DONE' } });
        continue;
      }

      // Build updates object dynamically, ignoring null/undefined to keep existing database values if LLM doesn't update them
      const updates = {};
      if (result.status_lead) updates.status_lead = result.status_lead;
      if (result.minat_destinasi !== undefined && result.minat_destinasi !== null) {
        if (Array.isArray(result.minat_destinasi)) {
          updates.minat_destinasi = result.minat_destinasi.join(', ');
        } else {
          updates.minat_destinasi = String(result.minat_destinasi);
        }
      }
      if (result.jumlah_peserta !== undefined && result.jumlah_peserta !== null) updates.jumlah_peserta = Number(result.jumlah_peserta);
      
      if (result.estimasi_waktu) {
        const parsedDate = new Date(result.estimasi_waktu);
        if (!isNaN(parsedDate.getTime())) {
          updates.estimasi_waktu = parsedDate;
        }
      }
      
      if (result.referral_source) updates.referral_source = result.referral_source;
      if (result.estimasi_nilai_order !== undefined && result.estimasi_nilai_order !== null) updates.estimasi_nilai_order = Number(result.estimasi_nilai_order);
      if (result.analysis_summary) {
        updates.ai_summary = result.analysis_summary;
        updates.catatan_khusus = result.analysis_summary;
      }

      // Closed/Lost handling
      const isClosedStatus = ['CLOSED WON', 'CLOSED LOST', 'CLOSED', 'LOST'].includes(result.status_lead);
      if (isClosedStatus) {
        if (!lead.closed_at) {
          updates.closed_at = new Date();
        }
      } else {
        updates.closed_at = null;
      }

      // Set sync checkpoints
      const latestMsgId = latestMessageIds.get(job.lead_id);
      if (latestMsgId) {
        updates.ai_last_analyzed_message_id = latestMsgId;
        updates.ai_last_analyzed_at = new Date();
      }

      // Apply updates in a transaction alongside audit log creation
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: job.lead_id },
          data: updates
        }),
        prisma.aIAnalysis.create({
          data: {
            lead_id: job.lead_id,
            result_json: result
          }
        }),
        prisma.aIJob.update({
          where: { id: job.id },
          data: { status: 'DONE' }
        })
      ]);

      console.log(`[AI Worker] Successfully processed Lead ${job.lead_id}. New Status: ${result.status_lead}`);
    } catch (saveErr) {
      console.error(`[AI Worker] Failed to save analysis result for Lead ${job.lead_id}:`, saveErr);
      await rescheduleFailedJob(job);
    }
  }
}

/**
 * Reschedule a failed job, or mark as FAILED if retry limit reached.
 * 
 * @param {object} job 
 */
async function rescheduleFailedJob(job) {
  const retryLimit = parseInt(process.env.AI_JOB_RETRY_LIMIT, 10) || 3;
  const nextRetryCount = job.retry_count + 1;
  
  try {
    if (nextRetryCount < retryLimit) {
      // Wait 5 minutes before retrying
      const nextExecution = new Date(Date.now() + 5 * 60 * 1000);
      await prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: 'WAITING',
          retry_count: nextRetryCount,
          execute_at: nextExecution
        }
      });
      console.log(`[AI Worker] Job ID ${job.id} (Lead ${job.lead_id}) failed. Rescheduled retry #${nextRetryCount} for ${nextExecution.toISOString()}`);
    } else {
      await prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          retry_count: nextRetryCount
        }
      });
      console.error(`[AI Worker] Job ID ${job.id} (Lead ${job.lead_id}) has reached maximum retry limit (${retryLimit}). Status set to FAILED.`);
    }
  } catch (err) {
    console.error(`[AI Worker] Failed to update retry status for job ID ${job.id}:`, err);
  }
}

/**
 * Call Gemini API with bulk leads context payload.
 *
 * @param {Array} leadsContext
 * @param {Array} imageAttachments [{ lead_id, ref, mimeType, data }] images labeled per lead
 * @returns {Promise<Array>}
 */
async function callGeminiBulk(leadsContext, imageAttachments = []) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const nowStr = new Date().toISOString().split('T')[0];

  // Greeting -> referral source mapping is managed in the database (cached in memory)
  const greetingRules = await getGreetingRules();
  const greetingRuleText = greetingRules.length > 0
    ? greetingRules.map(r => `"${r.keyword}" berarti "${r.source}"`).join(', ')
    : 'tidak ada aturan sapaan yang terdaftar';

  const SYSTEM_PROMPT = `Kamu adalah sistem analis CRM untuk perusahaan Trip Banyuwangi.
Saya akan memberikan data JSON Input yang berisi daftar leads yang perlu dianalisis beserta state saat ini, status 'admin_has_replied' (apakah admin/CS sudah pernah membalas percakapan lead ini), rangkuman analisis sebelumnya (jika ada), dan pesan-pesan baru yang belum dianalisis.

Tugasmu:
1. Analisis 'new_messages' untuk setiap lead secara independen. Jangan mencampuradukkan data antar lead.
2. Gabungkan konteks 'new_messages' dengan 'previous_summary' (jika ada) untuk mengidentifikasi pembaharuan informasi lead.
2b. LAMPIRAN GAMBAR: Beberapa pesan memiliki key 'image_ref' (misal "IMG_123"). Gambar aslinya dilampirkan setelah data JSON, masing-masing didahului teks label yang menyebutkan image_ref DAN lead_id pemiliknya. ATURAN KETAT: setiap gambar HANYA boleh dipakai sebagai konteks untuk lead yang lead_id-nya tertulis di label gambar tersebut — JANGAN PERNAH menggunakan gambar milik lead lain, meskipun isinya tampak relevan. Analisis isi gambar untuk konteks tambahan, misalnya: bukti transfer/struk pembayaran (kuat mengindikasikan CLOSED WON), screenshot paket/harga, atau foto form reservasi.
3. Ekstrak informasi secara presisi:
   - 'minat_destinasi' (wajib berupa string tunggal). Ikuti urutan prioritas berikut:
     a. NAMA PAKET dari katalog: jika pelanggan membalas/mengirim produk katalog (ditandai marker seperti [Membalas produk katalog: "..."] atau [Produk katalog: ...] dalam pesan), gunakan JUDUL produknya sebagai minat_destinasi. Buang awalan "Trip Banyuwangi" jika ada. Contoh: judul "Trip Banyuwangi 3H2M (opsi A)" maka isi "3H2M (opsi A)".
     b. NAMA PAKET dari form reservasi: jika dalam percakapan ada FORM RESERVASI (dikirim oleh admin maupun diisi/dikirim balik oleh pelanggan), gunakan nama paket yang tertulis di form tersebut, biasanya diapit tanda bintang. Contoh: "*Private Trip 2H1M*" maka isi "Private Trip 2H1M"; "*PRIVATE TRIP 2H1M Custome*" maka isi "PRIVATE TRIP 2H1M Custome".
     Jika ada lebih dari satu sinyal (katalog dan form), gunakan yang PALING BARU dalam percakapan.
     c. Jika tidak ada nama paket dari katalog/form, baru gunakan nama destinasi wisata yang disebut pelanggan; jika ada beberapa gabungkan dengan koma, misal: "Ijen, Baluran, Djawatan".
     d. Jika tidak ada info baru sama sekali, pertahankan info lama dari current_lead.
   - 'jumlah_peserta' (dalam format angka numerik).
   - 'estimasi_waktu' (format tanggal ISO YYYY-MM-DD. Jika pelanggan menyebutkan tanggal relatif, hitung berdasarkan tanggal hari ini: ${nowStr}).
   - 'analysis_summary' (catatan atau ringkasan singkat mengenai kebutuhan spesifik pelanggan, kesepakatan penting, atau rangkuman inti percakapan mereka).
   - 'referral_source' (dari mana mengetahui TripBwi, wajib pilih salah satu dari: "instagram", "tiktok", "website", "rekomendasi", "facebook", "lainnya", atau "tidak diketahui").
     Aturan khusus kata sapaan: HANYA berlaku jika pesan PALING AWAL dari seluruh percakapan dikirim oleh pelanggan (pelanggan yang memulai chat) DAN kalimatnya DIAWALI kata sapaan tersebut: ${greetingRuleText}. Sapaan di tengah percakapan atau di tengah kalimat TIDAK berlaku. Jika tidak ada sapaan yang cocok dan pelanggan tidak pernah menyebutkan sumbernya, isi "tidak diketahui". Jika 'referral_source' pada current_lead sudah terisi (bukan "tidak diketahui"), PERTAHANKAN nilai tersebut kecuali pelanggan secara eksplisit menyebutkan sumber lain.
   - 'estimasi_nilai_order' (estimasi nilai transaksi/order dalam format angka integer rupiah, jika tidak ada, isi dengan null).
4. Tentukan 'status_lead' dengan salah satu dari pilihan berikut:
   - NEW: Status awal lead masuk. Jika 'admin_has_replied' bernilai false (admin/CS belum pernah membalas chat sama sekali untuk lead ini), status WAJIB tetap 'NEW'. Pengecualian hanya jika pelanggan menunjukkan kondisi mendesak/urgent untuk segera melakukan transaksi/booking saat itu juga (contoh: "saya mau booking tur ijen malam ini juga", "minta rekening mau transfer sekarang"). Jika tidak ada kondisi mendesak/urgent dari pelanggan dan admin belum membalas, status tidak boleh beranjak dari 'NEW'.
   - QUALIFIED: Admin/CS sudah pernah membalas chat ('admin_has_replied' bernilai true) DAN pelanggan mengajukan pertanyaan mengenai informasi umum, harga, destinasi, atau fasilitas, tetapi belum ada kepastian jadwal/jumlah orang.
   - PROSPECT: Pelanggan sudah menyebutkan dengan JELAS Destinasi, Jumlah Peserta, DAN Jadwal/Estimasi Waktu keberangkatan.
   Urutan tahapan funnel: NEW -> QUALIFIED -> PROSPECT -> HOT -> CLOSED. Status hanya boleh naik mengikuti urutan tersebut, kecuali ada pembatalan (CLOSED LOST).
   - HOT: Pelanggan sudah setuju dan meminta instruksi pembayaran (rekening, invoice, atau berjanji transfer).
   - CLOSED WON: Pelanggan mengirimkan bukti transfer atau konfirmasi pembayaran berhasil.
   - CLOSED LOST: Pelanggan secara eksplisit membatalkan rencana, menolak tawaran, atau komplain keras.

Kembalikan respon HANYA berupa JSON Array murni tanpa format markdown (seperti \`\`\`json ... \`\`\`), berisi kumpulan hasil analisis setiap lead. Setiap objek dalam array wajib memiliki key: 'lead_id', 'status_lead', 'minat_destinasi', 'jumlah_peserta', 'estimasi_waktu', 'analysis_summary', 'referral_source', 'estimasi_nilai_order'.`;

  const modelsToTry = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-lite-preview',
    'gemini-3.1-flash-lite',
  ];

  let lastError = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    console.log(`[AI Worker] Attempting lead analysis using model: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT
      });

      // Build multimodal parts: the JSON payload first, then each image preceded by a
      // label part binding it to its owning lead_id + image_ref (prevents cross-lead mixups)
      const parts = [{ text: JSON.stringify(leadsContext) }];
      for (const img of imageAttachments) {
        parts.push({ text: `Gambar berikut adalah lampiran dengan image_ref "${img.ref}" dan HANYA milik lead_id ${img.lead_id}:` });
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.response.text();
      console.log(`[AI Worker] Successfully analyzed using model: ${modelName}`);
      return JSON.parse(responseText.trim());
    } catch (err) {
      lastError = err;
      const nextModel = modelsToTry[i + 1];
      console.warn(`[AI Worker Warning] Model ${modelName} failed: ${err.message}. ${nextModel ? `Rolling over to fallback model: ${nextModel}...` : 'No more models in fallback list.'}`);
    }
  }

  throw new Error(`All Gemini models failed in the fallback chain. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}
